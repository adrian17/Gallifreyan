buttons=[];

function Button(x, y, width, text, f){
	this.draw=function(){
		var temp=ctx.lineWidth;ctx.lineWidth=2;
		ctx.fillStyle="black";
		ctx.strokeStyle="black";
		ctx.beginPath();ctx.rect(this.x, this.y, this.width, this.height);ctx.stroke();
		ctx.font=String(Math.floor(20*canvasScale))+"px Georgia";
		ctx.fillText(text,this.x+8*canvasScale,this.y+this.height-8*canvasScale);
		ctx.lineWidth=temp;
	}
	this.click=function(e){
		var clickX = e.pageX-$('canvas').position().left, clickY = e.pageY-$('canvas').position().top;
		clickX=clickX*canvasScale, clickY=clickY*canvasScale;
		if(clickX>this.x && clickX<this.x+this.width && clickY>this.y && clickY<this.y+this.height){
			this.f();
			return 1;
		}
		else return 0;
	}
	this.x=x*canvasScale-0.5;
	this.y=y*canvasScale-0.5;
	this.width=width*canvasScale;
	this.height=30*canvasScale;
	this.text=text;
	this.f=f;
}

function createGUI(){
	buttons.push(new Button(0, 0, 60, "save", function(){createFinalImage();}));
	buttons.push(new Button(60, 0, 30, "+", 
		function(){lineWidth+=0.5; redraw();}
	));
	buttons.push(new Button(90, 0, 30, "-", 
		function(){lineWidth-=0.5;if(lineWidth<0.5)lineWidth=0.5; redraw();}
	));
}

function drawGUI(){
	for(var i=0;i<buttons.length;++i){
		buttons[i].draw();
	}
	ctx.fillText("are lines correct?: "+(checkLines()?"yes":"no"),10,canvasSize-60*canvasScale);
	ctx.fillText("(left click) edit mode: "+((selectedCircle==-1 && selectedLine==-1)?"no":"yes"),10,canvasSize-35*canvasScale);
	ctx.fillText("(right click) will snap according to rules: "+(snapMode?"yes":"no"),10,canvasSize-10*canvasScale);
}