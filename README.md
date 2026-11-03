# companion-surface-loupedeck

See [HELP.md](./companion/HELP.md) and [LICENSE](./LICENSE)

## Getting started

Executing a `yarn` command should perform all necessary steps to develop the module, if it does not then follow the steps below.

The module can be built once with `yarn build`. This should be enough to get the module to be loadable by companion.

While developing the module, by using `yarn dev` the compiler will be run in watch mode to recompile the files on change.

## Haptic feedback

On supported motor-capable surfaces, haptic feedback is enabled by default for each surface. Clear **Enable haptic feedback** in that surface's settings to disable every haptic request for that surface without affecting other surfaces. **Haptic feedback intensity** chooses a lighter or stronger click; the feel was tuned on a Loupedeck Live S and may differ on other models.

The adapter never vibrates directly from a raw touch, key press, draw, or startup event. It registers for control events, and clicks when Companion reports that a press ran actions (`press`) or a run-while-held group fired (`hold`). A hold's click runs slightly longer, because a finger already resting on the key damps it. The motor is shared by the whole device, so the control is ignored. Companion only sends these for action groups that have their surface cue turned on. The same per-surface setting applies to every event.

The haptic direction was informed by [ninoleto's split-strips v1.2.0](https://github.com/ninoleto/companion-surface-loupedeck-split-strips/tree/v1.2.0), adapted here to use Companion control events instead of touch-start feedback.
