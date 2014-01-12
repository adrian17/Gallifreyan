buttons=[];

function Button(x, y, width, text, f){
	this.draw=function(){
		var temp=ctx.lineWidth;ctx.lineWidth=1;
		ctx.fillStyle="black";
		ctx.strokeStyle="black";
		ctx.beginPath();ctx.rect(this.x, this.y, this.width, this.height);ctx.stroke();
		ctx.font="20px Georgia"; ctx.fillText(text,this.x+10,this.y+this.height-10);
		ctx.lineWidth=temp;
	}
	this.click=function(clickX, clickY){
		if(clickX>this.x && clickX<this.x+this.width && clickY>this.y && clickY<this.y+this.height){
			this.f();
			return 1;
		}
		else return 0;
	}
	this.x=x-0.5;
	this.y=y-0.5;
	this.width=width;
	this.height=30;
	this.text=text;
	this.f=f;
}

function createGUI(){
	buttons.push(new Button(0, 0, 80, "save", function(){createFinalImage();}));
	buttons.push(new Button(80, 0, 40, "+", 
		function(){lineWidth+=0.5; redraw();}
	));
	buttons.push(new Button(120, 0, 40, "-", 
		function(){lineWidth-=0.5;if(lineWidth<0.5)lineWidth=0.5; redraw();}
	));
}