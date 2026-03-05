(function () {
  'use strict';

  var HIDDEN_FIELDS_INPUT = 'cs-cl-hidden-fields';

  function parseJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return fallback;
    }
  }

  function normalizeName(name) {
    return String(name || '').replace(/\[\]$/, '');
  }

  function escapeName(name) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(name);
    }
    return name.replace(/([ #;?%&,.+*~\':"!^$\[\]()=>|\/])/g, '\\$1');
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value === undefined || value === null || value === '') {
      return [];
    }
    return [value];
  }

  function isEmpty(value) {
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return value === undefined || value === null || value === '';
  }

  function getInputsByName(form, fieldName) {
    var normalized = normalizeName(fieldName);
    if (!normalized) {
      return [];
    }

    var selector = [
      '[name="' + escapeName(normalized) + '"]',
      '[name="' + escapeName(normalized + '[]') + '"]'
    ].join(',');

    var nodes = Array.prototype.slice.call(form.querySelectorAll(selector));

    // Checkbox list root can keep data-name only.
    var listRoot = form.querySelector('[data-name="' + escapeName(normalized) + '"]');
    if (listRoot && nodes.indexOf(listRoot) === -1) {
      nodes.push(listRoot);
    }

    return nodes;
  }

  function getFieldValue(form, fieldName) {
    var nodes = getInputsByName(form, fieldName);
    if (!nodes.length) {
      return '';
    }

    var first = nodes[0];

    // Checkbox list root wrapper
    if (first.classList && first.classList.contains('cs-input-checkbox-list')) {
      var listName = first.getAttribute('data-name') || fieldName;
      var listInputs = getInputsByName(form, listName).filter(function (el) {
        return el.tagName === 'INPUT';
      });

      var checked = listInputs.filter(function (el) {
        return el.checked;
      }).map(function (el) {
        return el.value;
      });

      if (first.getAttribute('data-return-type') === 'delimiter') {
        var delimiter = first.getAttribute('data-return-delimiter') || ',';
        return checked.join(delimiter);
      }

      return checked;
    }

    var tag = (first.tagName || '').toUpperCase();
    var type = (first.type || '').toLowerCase();

    if (tag === 'SELECT' && first.multiple) {
      return Array.prototype.slice.call(first.selectedOptions).map(function (opt) {
        return opt.value;
      });
    }

    if (type === 'radio') {
      var checkedRadio = nodes.find(function (el) {
        return el.checked;
      });
      return checkedRadio ? checkedRadio.value : '';
    }

    if (type === 'checkbox') {
      if (nodes.length === 1 && normalizeName(first.name) === normalizeName(fieldName) && !/\[\]$/.test(first.name)) {
        return first.checked ? (first.value || 'on') : '';
      }

      return nodes.filter(function (el) {
        return el.checked;
      }).map(function (el) {
        return el.value;
      });
    }

    return first.value;
  }

  function compare(sourceValue, operator, expectedValue) {
    var values = toArray(sourceValue).map(String);
    var expectedArray = Array.isArray(expectedValue)
      ? expectedValue.map(String)
      : [String(expectedValue == null ? '' : expectedValue)];
    var sourceAsString = Array.isArray(sourceValue)
      ? sourceValue.join(',')
      : String(sourceValue == null ? '' : sourceValue);

    switch (operator) {
      case '==':
      case 'eq':
        return values.some(function (v) { return expectedArray.indexOf(v) !== -1; });
      case '!=':
      case 'neq':
        return !values.some(function (v) { return expectedArray.indexOf(v) !== -1; });
      case 'in':
        return expectedArray.indexOf(sourceAsString) !== -1;
      case 'not_in':
        return expectedArray.indexOf(sourceAsString) === -1;
      case 'contains':
        return sourceAsString.indexOf(String(expectedValue)) !== -1;
      case 'not_contains':
        return sourceAsString.indexOf(String(expectedValue)) === -1;
      case 'empty':
        return isEmpty(sourceValue);
      case 'not_empty':
        return !isEmpty(sourceValue);
      default:
        return false;
    }
  }

  function evaluateRule(form, rule) {
    if (!rule || typeof rule !== 'object') {
      return true;
    }

    var field = rule.field || rule.name || '';
    var operator = String(rule.operator || '==').toLowerCase();
    var expected = rule.value;
    var source = getFieldValue(form, field);

    return compare(source, operator, expected);
  }

  function evaluateSet(form, set) {
    var rules = Array.isArray(set.rules) ? set.rules : [];
    if (!rules.length) {
      return true;
    }

    var mode = String(set.match || 'all').toLowerCase();
    var results = rules.map(function (rule) {
      return evaluateRule(form, rule);
    });

    if (mode === 'any') {
      return results.some(Boolean);
    }

    return results.every(Boolean);
  }

  function getTargetContainers(form, targetName) {
    var nodes = getInputsByName(form, targetName);

    if (!nodes.length) {
      return [];
    }

    var containers = nodes.map(function (node) {
      return (
        node.closest('.cs-form-input-container') ||
        node.closest('.cs-input-checkbox-list') ||
        node
      );
    });

    return Array.from(new Set(containers));
  }

  function controlsInside(targetEl) {
    return Array.prototype.slice.call(
      targetEl.querySelectorAll('input, select, textarea, button')
    );
  }

  function setFieldValidationTemporarilyDisabled(control, disabled) {
    var attr = 'data-cs-forms-validations';
    var stash = 'csClValidations';

    if (disabled) {
      if (control.hasAttribute(attr)) {
        control.dataset[stash] = control.getAttribute(attr);
        control.removeAttribute(attr);
      }
      return;
    }

    if (!control.hasAttribute(attr) && control.dataset[stash]) {
      control.setAttribute(attr, control.dataset[stash]);
      delete control.dataset[stash];
    }
  }

  function toggleTarget(targetEl, show) {
    var controls = controlsInside(targetEl);

    if (show) {
      targetEl.hidden = false;
      targetEl.style.removeProperty('display');
    } else {
      targetEl.hidden = true;
      targetEl.style.setProperty('display', 'none', 'important');
    }
    targetEl.setAttribute('aria-hidden', show ? 'false' : 'true');

    controls.forEach(function (control) {
      if (!show) {
        control.dataset.csClDisabled = control.disabled ? '1' : '0';
        control.disabled = true;
        setFieldValidationTemporarilyDisabled(control, true);
        control.classList.remove('is-error');
      } else {
        var wasDisabled = control.dataset.csClDisabled === '1';
        control.disabled = wasDisabled;
        delete control.dataset.csClDisabled;
        setFieldValidationTemporarilyDisabled(control, false);
      }
    });

    Array.prototype.slice.call(targetEl.querySelectorAll('.cs-form-error-inline')).forEach(function (node) {
      node.remove();
    });
  }

  function collectHiddenFieldNames(formState) {
    var names = [];

    formState.targets.forEach(function (entry) {
      var targetName = normalizeName(entry.target || '');
      if (!targetName) {
        return;
      }

      var anyVisible = entry.containers.some(function (container) {
        return container.style.display !== 'none';
      });

      if (!anyVisible) {
        names.push(targetName);
      }
    });

    return Array.from(new Set(names));
  }

  function upsertHiddenFieldsInput(form, values) {
    var input = form.querySelector('input[name="' + HIDDEN_FIELDS_INPUT + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = HIDDEN_FIELDS_INPUT;
      form.appendChild(input);
    }

    input.value = values.join(',');
  }

  function revalidate(formState) {
    formState.targets.forEach(function (entry) {
      var show = evaluateSet(formState.form, entry.set);
      entry.containers.forEach(function (container) {
        toggleTarget(container, show);
      });
    });

    var hiddenFields = collectHiddenFieldNames(formState);
    upsertHiddenFieldsInput(formState.form, hiddenFields);
  }

  function buildFormState(form) {
    var map = parseJSON(form.getAttribute('data-cs-cl-map') || '[]', []);
    if (!Array.isArray(map) || !map.length) {
      return null;
    }

    var targets = [];

    map.forEach(function (set) {
      if (!set || typeof set !== 'object') {
        return;
      }

      var target = normalizeName(set.target || '');
      if (!target) {
        return;
      }

      var containers = getTargetContainers(form, target);
      if (!containers.length) {
        return;
      }

      targets.push({
        target: target,
        set: set,
        containers: containers
      });
    });

    if (!targets.length) {
      return null;
    }

    return {
      form: form,
      targets: targets
    };
  }

  function bindForm(form) {
    if (!form || form.dataset.csClReady === '1') {
      return;
    }

    var formState = buildFormState(form);
    if (!formState) {
      return;
    }

    form.dataset.csClReady = '1';

    var onChange = function () {
      revalidate(formState);
    };

    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);

    form.addEventListener('submit', function () {
      revalidate(formState);
    }, true);

    revalidate(formState);
  }

  function initAllForms() {
    Array.prototype.slice.call(document.querySelectorAll('form.cs-form')).forEach(bindForm);
  }

  function setupObservers() {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (mutation.addedNodes && mutation.addedNodes.length) {
          initAllForms();
          return;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    initAllForms();
    setupObservers();

    var hooks = window.csGlobal && window.csGlobal.csHooks;
    if (hooks && typeof hooks.action === 'function') {
      hooks.action('cornerstone-form', function (form) {
        bindForm(form);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
