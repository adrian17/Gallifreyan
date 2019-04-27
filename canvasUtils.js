"use strict";
const scrollerObj = new Scroller(function(left, top, zoom) {
    // apply coordinates/zooming
}, {
    zooming: true,
    locking: false,
    bouncing: false,
    animating: false,
    minZoom: 1,
    maxZoom: 10
});

var canvas, ctx, mousedown = false, mousemove = 0;

function prepareCanvas() {
    canvas = document.getElementById("canvas");
    canvas.onselectstart = function() { return false; }
    canvas.setAttribute('width', canvasSize);
    canvas.setAttribute('height', canvasSize);
    canvas.style.width = "800px";
    canvas.style.height = "800px";
    ctx = canvas.getContext("2d");

    ctx.lineCap = 'round';

    scrollerObj.setDimensions(800, 800, 800, 800);	//I'm almost certain that I'm doing this the wrong way, but somehow it works flawlessly
    scrollerObj.setPosition($('canvas').position().left, $('canvas').position().top);

    canvas.addEventListener("mousedown", function(e) {
        scrollerObj.doTouchStart([{ pageX: e.pageX, pageY: e.pageY }], e.timeStamp);
        mousemove = 0;
        mousedown = true;
        redraw();
    }, false);

    canvas.addEventListener("mousemove", function(e) {
        mousemove += 1;
        if (!mousedown) { return; }
        scrollerObj.doTouchMove([{ pageX: e.pageX, pageY: e.pageY }], e.timeStamp);
        redraw();
    }, false);

    canvas.addEventListener("mouseup", function(e) {
        if (mousemove <= 1) { //ignore the first mouseMove as sometimes it's triggered together with mouseDown
            doClick(e);
        }
        if (!mousedown) { return; }
        scrollerObj.doTouchEnd(e.timeStamp);
        mousedown = false;
        redraw();
    }, false);

};

function resetZoom() {
    scrollerObj.zoomTo(1);
}

function getMouse(e) {
    var mouseX = e.pageX - $('canvas').position().left, mouseY = e.pageY - $('canvas').position().top;
    var data = scrollerObj.getValues();
    mouseX = (data.left + mouseX) * canvasScale / data.zoom, mouseY = (data.top + mouseY) * canvasScale / data.zoom;
    return { x: mouseX, y: mouseY };
}

$('canvas').mousewheel(function(e, delta, deltaX, deltaY) {
    if (selectedCircle) return;
    scrollerObj.doMouseZoom(-delta * 3, e.timeStamp, e.pageX, e.pageY);
    redraw();
    return false;
})

$(document).on("contextmenu", "canvas", function(e) {
    return false;
});

function download(extension, href) {
    var e = document.createElement('a');
    e.href = href;
    e.download = 'gallifreyan.' + extension;
    document.body.appendChild(e);
    e.click();
    document.body.removeChild(e);
}

function createFinalSVG() {
    dirtyRender = false;

    let oldctx = ctx;
    ctx = new C2S(canvasSize, canvasSize);
    redraw();
    let svg = ctx.getSerializedSvg();
    ctx = oldctx;

    download('svg', 'data:image/svg+xml; charset=utf8, ' + encodeURIComponent(svg));

    dirtyRender = true;
    redraw();
}

function createFinalImage() {
    dirtyRender = false;
    redraw();

    download('png', canvas.toDataURL());

    dirtyRender = true;
    redraw();
}
