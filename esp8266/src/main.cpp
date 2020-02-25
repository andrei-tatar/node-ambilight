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
  {
    IPAddress ip = webSocket.remoteIP(num);

    if (num != 0)
    {
      webSocket.disconnect(num);
    }
    else
    {
      FastLED.clear(true);
    }
  }
  break;

  case WStype_BIN:
    for (uint16_t i = 0; i < length; i += 3)
    {
      leds[i / 3].setRGB(payload[i], payload[(i + 1)], payload[(i + 2)]);
    }
    FastLED.show();
    break;

  default:
    FastLED.clear();
    leds[0] = CRGB::Red;
    FastLED.show();
    break;
  }
}

void setup()
{
  FastLED.addLeds<CHIPSET, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS).setCorrection(TypicalSMD5050);
  FastLED.setBrightness(255);

  FastLED.clear();
  leds[0] = CRGB::Yellow;
  FastLED.show();

  WiFi.begin(ssid, password);
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
  webSocket.loop();
}