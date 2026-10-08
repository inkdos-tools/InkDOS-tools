// InkDOS-tools: keep this tool on the device (its folder's sw.js, written by build.py from viewers/offline-sw.js)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
