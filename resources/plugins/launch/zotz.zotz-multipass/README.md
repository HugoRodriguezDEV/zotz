# Multipass VM Recipes

Zotz's copy of Orca's official
[Multipass VM Recipes](https://github.com/stablyai/orca-plugins/tree/main/plugins/multipass-recipes)
plugin (2.0.1), shipped so it works with Orca's plugin catalog turned off.

The **Multipass Ubuntu LTS** recipe creates a four-CPU, 8 GB Ubuntu 24.04 VM, copies the
project into it and connects over SSH. Suspend, resume and destroy map to Multipass.

Changes from upstream:

- The SSH key lives in `${XDG_STATE_HOME:-$HOME/.local/state}/zotz/multipass/`.
- Create stops with install steps when `multipass` is missing.
- The recipe id is `zotz-multipass-ubuntu-lts`, so it never clashes with Orca's copy.

The recipe is a POSIX shell script: Zotz offers it on macOS and Linux only.

## License

MIT, copyright Lovecast Inc. (see [LICENSE](LICENSE)).
