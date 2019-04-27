"use strict";
const buttons = [];

function Button(x, y, width, text, f) {
    this.draw = function() {
        var temp = ctx.lineWidth; ctx.lineWidth = 2;
        ctx.fillStyle = "black";
        ctx.strokeStyle = "black";
        ctx.beginPath(); ctx.rect(this.x, this.y, this.width, this.height); ctx.stroke();
        ctx.font = String(Math.floor(20 * canvasScale)) + "px Georgia";
        ctx.fillText(text, this.x + 8 * canvasScale, this.y + this.height - 8 * canvasScale);
        ctx.lineWidth = temp;
    }
    this.click = function(e) {
        var clickX = e.pageX - $('canvas').position().left, clickY = e.pageY - $('canvas').position().top;
        clickX = clickX * canvasScale, clickY = clickY * canvasScale;
        if (clickX > this.x && clickX < this.x + this.width && clickY > this.y && clickY < this.y + this.height) {
            resetModes();	//discard unfinished edits when toggling a new button
            this.f();
            return 1;
        }
        else return 0;
    }
    this.x = x * canvasScale - 0.5;
    this.y = y * canvasScale - 0.5;
    this.width = width * canvasScale;
    this.height = 30 * canvasScale;
    this.text = text;
    this.f = f;
}

function createGUI() {
    buttons.push(new Button(0, 0, 130, "save image", createFinalImage));
    buttons.push(new Button(0, 30, 110, "save SVG", createFinalSVG));
    buttons.push(new Button(800 - 170, 0, 110, "line width", function() { }));
    buttons.push(new Button(800 - 170, 30, 170, "delete line", function() { deleteLineMode = true; redraw(); }));
    buttons.push(new Button(800 - 170, 60, 170, "add line", function() { addNewLine(); redraw(); }));
    buttons.push(new Button(800 - 60, 0, 30, "+",
        function() { lineWidth += 0.5; redraw(); }
    ));
    buttons.push(new Button(800 - 30, 0, 30, "−",
        function() { lineWidth -= 0.5; if (lineWidth < 0.5) lineWidth = 0.5; redraw(); }
    ));
}

function drawGUI() {
    for (let button of buttons) {
        button.draw();
    }
    ctx.fillText("are lines correct?: " + (checkLines() ? "yes" : "no"), 10, canvasSize - 10 * canvasScale);
}