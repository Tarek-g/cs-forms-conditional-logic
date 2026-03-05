<?php
/**
 * Plugin Name: CS Forms Conditional Logic (Addon)
 * Description: Front-end conditional show/hide logic for Cornerstone Forms fields via visual controls.
 * Plugin URI: https://github.com/Tarek-g/cs-forms-conditional-logic
 * Version: 0.0.1
 * Author: Tarek AlGhorani
 * Author URI: https://github.com/Tarek-g
 * License: GPL-2.0-or-later
 * Text Domain: cs-forms-conditional-logic
 */

if (!defined('ABSPATH')) {
  exit;
}

final class CS_Forms_Conditional_Logic_Addon {
  const VERSION = '0.0.1';

  private static $target_elements = [
    'cornerstone-form-input',
    'cornerstone-form-textarea',
    'cornerstone-form-select',
    'cornerstone-form-checkbox-list',
    'cornerstone-form-dropzone',
    'cornerstone-form-flatpickr',
  ];

  public static function boot() {
    add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_assets'], 120);

    add_action('cs_forms_booted', [__CLASS__, 'extend_element_controls'], 20);
    add_action('init', [__CLASS__, 'extend_element_controls_fallback'], 20);

    add_filter('cs_element_pre_render_cornerstone-form', [__CLASS__, 'inject_form_logic_map'], 20, 2);
    add_filter('cs_element_render_function', [__CLASS__, 'skip_hidden_field_backend_validation'], 20, 2);
  }

  public static function enqueue_assets() {
    $url = plugin_dir_url(__FILE__) . 'assets/js/cs-forms-conditional-logic.js';
    wp_register_script(
      'cs-forms-conditional-logic',
      $url,
      ['cs'],
      self::VERSION,
      true
    );
    wp_enqueue_script('cs-forms-conditional-logic');
  }

  public static function extend_element_controls_fallback() {
    if (did_action('cs_forms_booted')) {
      return;
    }

    self::extend_element_controls();
  }

  public static function extend_element_controls() {
    static $done = false;

    if ($done || !function_exists('cs_get_element') || !function_exists('cs_value')) {
      return;
    }

    foreach (self::$target_elements as $type) {
      self::extend_single_element($type);
    }

    $done = true;
  }

  private static function extend_single_element($type) {
    $definition = cs_get_element($type);
    if (empty($definition) || empty($definition->def)) {
      return;
    }

    if (!empty($definition->def['options']['cs_cl_extended'])) {
      return;
    }

    if (empty($definition->def['values']) || !is_array($definition->def['values'])) {
      $definition->def['values'] = [];
    }

    $definition->def['values'] = array_merge($definition->def['values'], [
      'cl_enabled' => cs_value(false, 'markup:bool'),
      'cl_match' => cs_value('all', 'markup'),
      'cl_rules' => cs_value([], 'markup:array'),
    ]);

    $old_builder = isset($definition->def['builder']) ? $definition->def['builder'] : null;
    if (!is_callable($old_builder)) {
      return;
    }

    $definition->def['builder'] = function() use ($old_builder) {
      $controls = call_user_func($old_builder);

      if (empty($controls) || !is_array($controls)) {
        return $controls;
      }

      if (empty($controls['control_nav']) || !is_array($controls['control_nav'])) {
        $controls['control_nav'] = [];
      }

      if (empty($controls['controls']) || !is_array($controls['controls'])) {
        $controls['controls'] = [];
      }

      $controls['control_nav']['element:conditional-logic'] = __('Conditional Logic', 'cornerstone');

      $conditional_group = [
        'type' => 'group',
        'group' => 'element:conditional-logic',
        'controls' => [
          [
            'key' => 'cl_enabled',
            'type' => 'toggle',
            'label' => __('Enable Conditional Logic', 'cornerstone'),
            'description' => __('Show or hide this field based on another field value.', 'cornerstone'),
          ],
          [
            'key' => 'cl_match',
            'type' => 'select',
            'label' => __('Match', 'cornerstone'),
            'options' => [
              'choices' => [
                ['value' => 'all', 'label' => __('All Rules (AND)', 'cornerstone')],
                ['value' => 'any', 'label' => __('Any Rule (OR)', 'cornerstone')],
              ],
            ],
            'conditions' => [
              ['key' => 'cl_enabled', 'op' => '==', 'value' => true],
            ],
          ],
          [
            'key' => 'cl_rules',
            'type' => 'list',
            'label' => __('Rules', 'cornerstone'),
            'description' => __('Use source field name, operator, and value.', 'cornerstone'),
            'options' => [
              'item_label' => '{{index}}. {{field}} {{operator}} {{value}}',
              'initial' => [
                'field' => '',
                'operator' => '==',
                'value' => '',
              ],
            ],
            'conditions' => [
              ['key' => 'cl_enabled', 'op' => '==', 'value' => true],
            ],
            'controls' => [
              [
                'key' => 'field',
                'type' => 'text',
                'label' => __('Source Field Name', 'cornerstone'),
                'options' => [
                  'placeholder' => __('example: contact_method', 'cornerstone'),
                ],
              ],
              [
                'key' => 'operator',
                'type' => 'select',
                'label' => __('Operator', 'cornerstone'),
                'options' => [
                  'choices' => [
                    ['value' => '==', 'label' => __('Equals', 'cornerstone')],
                    ['value' => '!=', 'label' => __('Not Equals', 'cornerstone')],
                    ['value' => 'contains', 'label' => __('Contains', 'cornerstone')],
                    ['value' => 'not_contains', 'label' => __('Not Contains', 'cornerstone')],
                    ['value' => 'empty', 'label' => __('Is Empty', 'cornerstone')],
                    ['value' => 'not_empty', 'label' => __('Is Not Empty', 'cornerstone')],
                  ],
                ],
              ],
              [
                'key' => 'value',
                'type' => 'text',
                'label' => __('Value', 'cornerstone'),
                'options' => [
                  'placeholder' => __('example: phone', 'cornerstone'),
                ],
                'conditions' => [
                  ['key' => 'operator', 'op' => 'NOT IN', 'value' => ['empty', 'not_empty']],
                ],
              ],
            ],
          ],
        ],
      ];

      $controls['controls'][] = $conditional_group;
      return $controls;
    };

    $definition->def['options']['cs_cl_extended'] = true;
  }

  public static function inject_form_logic_map($element, $definition) {
    if (empty($element['_modules']) || !is_array($element['_modules'])) {
      return $element;
    }

    $map = self::extract_map_from_modules($element['_modules']);

    if (empty($map)) {
      return $element;
    }

    $element['form_data-cs-cl-map'] = wp_json_encode($map);

    return $element;
  }

  private static function extract_map_from_modules($modules) {
    $out = [];

    foreach ($modules as $module) {
      if (!is_array($module)) {
        continue;
      }

      $type = isset($module['_type']) ? $module['_type'] : '';

      if (in_array($type, self::$target_elements, true)) {
        $enabled = !empty($module['cl_enabled']);
        $name = isset($module['name']) ? self::normalize_field_name($module['name']) : '';
        $rules = isset($module['cl_rules']) && is_array($module['cl_rules']) ? $module['cl_rules'] : [];

        if ($enabled && $name !== '' && !empty($rules)) {
          $normalized_rules = [];

          foreach ($rules as $rule) {
            if (!is_array($rule)) {
              continue;
            }

            $field = isset($rule['field']) ? self::normalize_field_name($rule['field']) : '';
            $operator = isset($rule['operator']) ? (string) $rule['operator'] : '==';
            $value = isset($rule['value']) ? $rule['value'] : '';

            if ($field === '') {
              continue;
            }

            $normalized_rules[] = [
              'field' => $field,
              'operator' => $operator,
              'value' => $value,
            ];
          }

          if (!empty($normalized_rules)) {
            $match = isset($module['cl_match']) && $module['cl_match'] === 'any' ? 'any' : 'all';

            $out[] = [
              'target' => $name,
              'match' => $match,
              'rules' => $normalized_rules,
            ];
          }
        }
      }

      if (!empty($module['_modules']) && is_array($module['_modules'])) {
        $out = array_merge($out, self::extract_map_from_modules($module['_modules']));
      }
    }

    return $out;
  }

  public static function skip_hidden_field_backend_validation($render_fn, $element) {
    $hidden = self::requested_hidden_fields();

    if (empty($hidden)) {
      return $render_fn;
    }

    return function($current) use ($render_fn, $hidden) {
      if (empty($current['_type']) || !in_array($current['_type'], self::$target_elements, true)) {
        return $render_fn($current);
      }

      if (!cs_form_has_any_submission() || cs_form_has_validated()) {
        return $render_fn($current);
      }

      $name = isset($current['name']) ? (string) $current['name'] : '';
      if ($name === '') {
        return $render_fn($current);
      }

      $normalized = self::normalize_field_name($name);
      if (!in_array($normalized, $hidden, true)) {
        return $render_fn($current);
      }

      // During backend validation pass, skip hidden-by-logic fields completely.
      return null;
    };
  }

  private static function requested_hidden_fields() {
    static $cached = null;

    if ($cached !== null) {
      return $cached;
    }

    $raw = isset($_REQUEST['cs-cl-hidden-fields']) ? wp_unslash($_REQUEST['cs-cl-hidden-fields']) : '';

    if (!is_string($raw) || $raw === '') {
      $cached = [];
      return $cached;
    }

    $parts = array_filter(array_map('trim', explode(',', $raw)));
    if (empty($parts)) {
      $cached = [];
      return $cached;
    }

    $normalized = [];
    foreach ($parts as $part) {
      $safe = sanitize_key(str_replace('-', '_', self::normalize_field_name($part)));
      if ($safe !== '') {
        $normalized[] = $safe;
      }
    }

    $cached = array_values(array_unique($normalized));
    return $cached;
  }

  private static function normalize_field_name($name) {
    $name = (string) $name;
    $name = preg_replace('/\[\]$/', '', $name);
    return $name;
  }
}

CS_Forms_Conditional_Logic_Addon::boot();
