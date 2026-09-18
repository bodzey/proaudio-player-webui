import { createSignal, onCleanup, onMount } from 'solid-js';

type InstallOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: InstallOutcome;
    platform: string;
  }>;
}

function isStandalone(): boolean {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true
  );
}

export function createPwaInstallController() {
  const [promptEvent, setPromptEvent] = createSignal<BeforeInstallPromptEvent>();
  const [installed, setInstalled] = createSignal(isStandalone());
  const [installing, setInstalling] = createSignal(false);

  onMount(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setPromptEvent(undefined);
      setInstalled(true);
      setInstalling(false);
    };

    const onDisplayModeChange = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayModeChange);

    onCleanup(() => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayModeChange);
    });
  });

  const install = async () => {
    const event = promptEvent();
    if (!event || installing()) return;

    setInstalling(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setPromptEvent(undefined);
      if (choice.outcome === 'accepted') setInstalled(true);
    } finally {
      setInstalling(false);
    }
  };

  return {
    canInstall: () => Boolean(promptEvent()) && !installed(),
    installed,
    installing,
    install,
  };
}
