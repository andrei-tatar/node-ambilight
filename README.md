# node-ambilight

[![npm](https://img.shields.io/npm/v/@andrei-tatar/node-webcam-ambilight.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/@andrei-tatar/node-webcam-ambilight)
[![downloads](https://img.shields.io/npm/dm/@andrei-tatar/node-webcam-ambilight.svg?style=flat-square)](https://www.npmjs.com/package/@andrei-tatar/node-webcam-ambilight)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg?style=flat-square&logo=paypal)](https://paypal.me/andreitatar)

## Hardware
RPi 3 + RPi camera + ESP8266 + ws2812 

## Software
node.js + opencv + angular client


## Flow 
camera -> opencv -> sampling and adjustments (node.js) -> web socket -> ESP8266 -> ws2812 leds.

### Project is still a work in progress. 

To get started just `npm install -g @andrei-tatar/node-webcam-ambilight`. It might take a while as (depending on your config) it downloads and builds opencv.
After installation is complete you can start it with the command `node-ambilight`.
It will host an http server on http://localhost:3000. Here you can set the area to be sampled by moving the dots over the window.
Most of the configuration can only be manually changed in the file `~/.node-ambilight`.

## Demo
[![IMAGE ALT TEXT HERE](https://img.youtube.com/vi/voDa9won3kM/0.jpg)](https://www.youtube.com/watch?v=voDa9won3kM)


