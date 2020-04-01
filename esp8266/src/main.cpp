#include <stdint.h>

// Wifi SSID and password
const char *ssid = "";
const char *password = "";

#define LED_PIN 3
#define COLOR_ORDER GRB
#define CHIPSET WS2812B
#define NUM_LEDS 166

#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <WebSocketsServer.h>
#include <Hash.h>
WebSocketsServer webSocket = WebSocketsServer(81);

#define FASTLED_INTERRUPT_RETRY_COUNT 0
#define FASTLED_ALLOW_INTERRUPTS 0
#define FASTLED_ESP8266_DMA
#include <FastLED.h>

CRGB leds_plus_safety_pixel[NUM_LEDS + 1];
CRGB *const leds(leds_plus_safety_pixel + 1);
uint32_t lastUpdate;
bool updated = false;

void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case WStype_DISCONNECTED:
    if (num == 0)
    {
      FastLED.clear(true);
    }
    break;

  case WStype_CONNECTED:
    if (num != 0)
    {
      webSocket.disconnect(num);
    }
    else
    {
      FastLED.clear(true);
    }
    break;

  case WStype_BIN:
    lastUpdate = millis();
    updated = true;
    for (uint8_t i = 0; i < NUM_LEDS; i++)
    {
      leds[i].setRGB(*payload++, *payload++, *payload++);
    }
    FastLED.show();
    break;
  }
}

void setup()
{
  FastLED.addLeds<CHIPSET, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalSMD5050);
  FastLED.setBrightness(255);

  if (strlen(ssid))
  {
    WiFi.begin(ssid, password);
  }

  while (WiFi.status() != WL_CONNECTED)
  {
    leds[0] = CRGB::Orange;
    FastLED.show();
    delay(200);
    leds[0] = CRGB::Black;
    FastLED.show();
    delay(200);
  }

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop()
{
  if (updated && millis() > lastUpdate + 1000)
  {
    updated = false;
    FastLED.clear(true);
  }
  webSocket.loop();
}