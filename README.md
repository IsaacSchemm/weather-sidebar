Weather Sidebar
===============

https://www.lakora.us/weather

This is a cross-browser weather forecast sidebar. It shows the current
temperature and weather, along with an hourly forecast for the next 12 hours,
using the [Dark Sky API](https://darksky.net/dev/).

Weather icons can use native emoji (the default on most systems) or
[Twitter emoji](https://github.com/twitter/twemoji) (the default on
Windows 7 and prior.)

Weather Sidebar does not have any name / zipcode support for location lookup
at this time. Instead, either use the browser's geolocation support (default)
or enter your own latitude/longitude in the settings area.

Browser requirements:
* Firefox
  * Use the [Side View](https://addons.mozilla.org/en-US/firefox/addon/side-view/)
    extension to load it in the sidebar.
* Pale Moon
  * Add Weather Sidebar to your bookmarks, then edit the bookmark properties
    to open in the sidebar. For more details, see:
	https://www.howtogeek.com/251625/how-to-load-a-website-in-firefoxs-sidebar
* SeaMonkey / Netscape / Classilla
  * Use Weather Sidebar's "Add to sidebar" link.
* Vivaldi
  * Add Weather Sidebar as a Web Panel
    (https://help.vivaldi.com/article/web-panels).

Branches
--------

* *master*: Pure JavaScript, no compilation required.
  Requires [async/await](http://caniuse.com/#feat=async-functions) support in
  the browser.
* *legacy-support*: Uses TypeScript to compile async functions into code that
  uses Promise callbacks, which expands browser support to pretty much
  anything that supports localStorage and JSON. Also adds various polyfills 
  (most of which are loaded only if needed) to provide support for Clasilla
  and possibly other niche or legacy browsers.
