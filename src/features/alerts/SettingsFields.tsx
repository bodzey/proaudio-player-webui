import { Show, createSignal, untrack, type Component, type JSX } from 'solid-js';

export const SettingsGroup: Component<{
  title: string;
  description?: string;
  children: JSX.Element;
}> = (props) => (
  <fieldset class="settings-group">
    <legend>{props.title}</legend>
    <Show when={props.description}>
      <p class="settings-help">{props.description}</p>
    </Show>
    <div class="settings-fields">{props.children}</div>
  </fieldset>
);

export const SettingsNumber: Component<{
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | 'any';
  help?: string;
}> = (props) => (
  <label class="settings-field">
    <span>{props.label}</span>
    <input
      class="settings-input"
      name={props.name}
      type="number"
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      required
      value={props.value}
    />
    <Show when={props.help}>
      <small>{props.help}</small>
    </Show>
  </label>
);

export const SettingsRange: Component<{
  name: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  help?: string;
}> = (props) => {
  const [value, setValue] = createSignal(untrack(() => props.value));
  return (
    <div class="settings-range">
      <label class="settings-range-heading" for={`settings-${props.name}`}>
        <span>{props.label}</span>
        <span class="settings-range-value">
          {value()} {props.unit}
        </span>
      </label>
      <div class="settings-range-controls">
        <input
          id={`settings-${props.name}`}
          type="range"
          min={props.min}
          max={props.max}
          step="any"
          value={value()}
          aria-label={props.label}
          aria-valuetext={`${value()} ${props.unit}`}
          onInput={(event) => {
            const steps = Math.round((Number(event.currentTarget.value) - props.min) / props.step);
            setValue(Number((props.min + steps * props.step).toFixed(8)));
          }}
        />
        <input
          class="settings-input"
          name={props.name}
          type="number"
          min={props.min}
          max={props.max}
          step="any"
          required
          value={value()}
          aria-label={`${props.label}, точне значення`}
          onInput={(event) => {
            if (event.currentTarget.validity.valid) setValue(event.currentTarget.valueAsNumber);
          }}
        />
      </div>
      <Show when={props.help}>
        <p class="settings-help">{props.help}</p>
      </Show>
    </div>
  );
};

export const SettingsSwitch: Component<{
  name: string;
  label: string;
  checked: boolean;
  help: string;
}> = (props) => (
  <label class="settings-switch">
    <span>
      <b>{props.label}</b>
      <small>{props.help}</small>
    </span>
    <input name={props.name} type="checkbox" role="switch" checked={props.checked} />
  </label>
);
