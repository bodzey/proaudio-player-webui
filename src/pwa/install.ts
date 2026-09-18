import { createSignal, onCleanup, onMount } from 'solid-js';

type InstallOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: InstallOutcome;
    platform: string;
  }>;
}

let deferredPrompt: BeforeInstallPromptEvent | undefined;
const promptListeners = new Set<(event: BeforeInstallPromptEvent) => void>();

function captureInstallPrompt(event: Event) {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  for (const listener of promptListeners) listener(deferredPrompt);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', captureInstallPrompt);
}

function isStandalone(): boolean {
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    standaloneNavigator.standalone === true
  );
}

export function createPwaInstallController() {
  const [promptEvent, setPromptEvent] = createSignal<BeforeInstallPromptEvent | undefined>(
    deferredPrompt,
  );
  const [installed, setInstalled] = createSignal(isStandalone());
  const [installing, setInstalling] = createSignal(false);

  onMount(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onPrompt = (event: BeforeInstallPromptEvent) => setPromptEvent(event);

    const onInstalled = () => {
      deferredPrompt = undefined;
      setPromptEvent(undefined);
      setInstalled(true);
      setInstalling(false);
    };

    const onDisplayModeChange = () => setInstalled(isStandalone());

    promptListeners.add(onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayModeChange);

    onCleanup(() => {
      promptListeners.delete(onPrompt);
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
      deferredPrompt = undefined;
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
