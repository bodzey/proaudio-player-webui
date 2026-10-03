import { Show, createEffect, createSignal, type Component, type JSX } from 'solid-js';

interface PageSectionProps {
  active: boolean;
  retain?: boolean;
  class: string;
  children: JSX.Element;
}

/** Retain visited forms and searches without loading unopened sections. */
export const PageSection: Component<PageSectionProps> = (props) => {
  const [visited, setVisited] = createSignal(false);
  createEffect(() => {
    if (props.active) setVisited(true);
  });

  return (
    <Show when={props.active || (props.retain && visited())}>
      <div class={props.class} hidden={!props.active}>
        {props.children}
      </div>
    </Show>
  );
};
