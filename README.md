# ProAudio Player Web UI

Browser frontend for ProAudio Player.

This repository contains only the frontend client. Player logic, protocol integrations, alerts, source arbitration and the HTTP control backend live in `proaudio-player-native`.

New frontend development should target the versioned `/api/v1` control API. The current imported frontend still uses legacy `/api` aliases for compatibility with the existing appliance UI.

The frontend is intended to be optional. A ProAudio Player build without this repository must remain fully functional as a headless player and API service.
