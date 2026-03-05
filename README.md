# CS Forms Conditional Logic (Addon)

Frontend conditional logic (show/hide) for **Cornerstone Forms** fields.

## Scope

Supported element types:

- `cornerstone-form-input`
- `cornerstone-form-textarea`
- `cornerstone-form-select`
- `cornerstone-form-checkbox-list`
- `cornerstone-form-dropzone`
- `cornerstone-form-flatpickr`

## License

GPL-2.0-or-later

## Behavior Notes

- Rules use source field `name` only. Do not use DC syntax.
- Comparison is string-based.
- Hidden targets are:
  - force-hidden on frontend,
  - disabled before submit,
  - excluded from validation pass.
- Works in both builder preview and published pages.

## Current Limits

- Captcha elements (reCAPTCHA/hCaptcha/Turnstile) are fully usable in forms, but are not supported as conditional-logic targets in this addon version.
- Third-party custom elements are unsupported unless they follow standard `name` flow.
