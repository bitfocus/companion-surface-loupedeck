## Loupedeck

We currently support the following models:

- Loupedeck Live
- Loupedeck Live S
- Loupedeck CT
- Razer Stream Controller
- Razer Stream Controller X

If you are having issues, make sure your firmware is up to date. We require the more recent firmware which operates over serial instead of websockets. The Loupedeck software must not be running, otherwise we will be unable to access your Loupedecks.

The layout closely matches the natural grid layout of each device.

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
