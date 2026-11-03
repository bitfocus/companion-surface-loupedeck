## Loupedeck

We currently support the following models:

- Loupedeck Live
- Loupedeck Live S
- Loupedeck CT
- Razer Stream Controller
- Razer Stream Controller X

If you are having issues, make sure your firmware is up to date. We require the more recent firmware which operates over serial instead of websockets. The Loupedeck software must not be running, otherwise we will be unable to access your Loupedecks.

The layout closely matches the natural grid layout of each device.

### Haptic feedback

Supported motor-capable surfaces enable haptic feedback by default. Clear **Enable haptic feedback** in a surface's settings to turn it off only for that surface. **Haptic feedback intensity** chooses a lighter or stronger click; the feel was tuned on a Loupedeck Live S and may differ on other models. The adapter never vibrates directly from raw touches, key presses, redraws, or startup. It clicks when Companion reports that a press ran actions or a run-while-held group fired; a hold's click runs slightly longer, because the finger resting on the key damps it. Turn off **Surface cue** on an action group to stop its click. The same per-surface setting applies to every click.

The haptic direction was informed by [ninoleto's split-strips v1.2.0](https://github.com/ninoleto/companion-surface-loupedeck-split-strips/tree/v1.2.0), adapted here to use Companion control events instead of touch-start feedback.

![Loupedeck Live template](images/loupedeck-live.png?raw=true 'Loupedeck Live template')

[Loupedeck Live template](assets/loupedeck-live-template.companionconfig)

### Side touch strips Variables

Touching and swiping on the tall touch strips can be mapped to user-defined custom variables. Values vary from 0 to 256.

To enable this feature you must first define custom variables. For example, got to the Custom Variables tab and add the following two variables: `$(custom:contourShuttleJog)` and `$(custom:contourShuttleRing)`...

![Define Contour Shuttle Variables](images/contour-shuttle-custom-variables.png?raw=true 'Define Contour Shuttle Variables')

Once the variables have been defined, go to the **_Configured Surfaces_** page and select the variables in the right-hand _Settings_ panel:

![Set Contour Shuttle Variables](images/contour-shuttle-set-custom-variables.png?raw=true 'Set Contour Shuttle Variables')

Now the variables will be set by the Contour Shuttle. Using the example names defined above:

- `$(custom:contourShuttleJog)` (+1/-1): indicates the rotational direction of the jog wheel for 20 ms after each click-stop.
- `$(custom:contourShuttleRing)` (-7 to +7): indicates the current shuttle position
