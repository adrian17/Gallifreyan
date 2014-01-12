var canvasSize = 800;
var midPoint = canvasSize / 2;
var outerR=midPoint*0.9;
var globalR;
var lineWidth=3.0;
var mcR=midPoint*0.60;
var PI=Math.PI;

var allCircles=[],
	mainCircles=[],
	currentCircle,	//points to a mainCircle which contains selectedCircle
	selectedCircle=-1, //points to selected circle
	snapMode=true;

var lines=[],
	selectedLine=-1,
	lineEnd=0;

var ctx;
var dirtyRender=1;

var word,
	wordL;	//final number of circles around the mainCircle

Array.prototype.contains = function(k){
    for(var p in this)
        if(this[p] === k)
            return true;
    return false;
}

Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
function dist(a,b,x,y){return Math.sqrt(Math.pow((a-x),2)+Math.pow((b-y),2))}

$(document).ready(function(){
	$('input').val(localStorage.getItem("input"));

	var canvas=document.getElementById("canvas");
	canvas.onselectstart = function () { return false; }
	canvas.setAttribute('width', canvasSize);
	canvas.setAttribute('height', canvasSize);
	ctx=canvas.getContext("2d");
	
	createGUI();
	
	redraw();
});

function updateText(){
	mainCircles=[];allCircles=[];lines=[];currentCircle=0;
	
	var t=$('input').val().trim().toLowerCase().split(" ");
	localStorage.setItem("input", $('input').val());
	var w=[];
	for(var j=0;j<t.length;j++){
		var toParse=t[j];
		w.push([]);
		for(var i=0;i<toParse.length;i++){
			if(i==toParse.length){w[j].push(toParse[toParse.length-1]); break;}
			if(toParse.substring(i, i+2).match("(ch|sh|th|ng|qu)")) {w[j].push(toParse.substring(i, i+2)); i++;}
			else w[j].push(toParse[i]);
		}
	}
	word=w[0];//TODO: multiple words
	wordL=0;
	for(var i=0;i<word.length;i++){
		if(i>0 && word[i].match("(a|e|i|o|u)") && !(word[i-1].match("(a|e|i|o|u)"))) continue;
		wordL++;
	}
	generateWord(word);
}

function Line(circle1, a1, circle2, a2){
	this.draw=function(){
		ctx.beginPath(); ctx.moveTo(this.points[0].x, this.points[0].y); ctx.lineTo(this.points[1].x, this.points[1].y); ctx.stroke();
		if(dirtyRender){ctx.beginPath(); ctx.arc(this.points[0].x,this.points[0].y,3,0,PI*2);ctx.fillStyle="red"; ctx.fill();
						ctx.beginPath(); ctx.arc(this.points[1].x,this.points[1].y,3,0,PI*2);ctx.fillStyle="red"; ctx.fill();
		}
	}
	this.update=function(){
		for(var i=0;i<2;++i){
			var point=this.points[i];
			point.x=point.circle.x+point.circle.r*Math.cos(point.a);
			point.y=point.circle.y+point.circle.r*Math.sin(point.a);
		}
	}
	this.updatePoint=function(i, circle, a){
		var point=this.points[i];
		point.circle.lines.remove(point.circle.lines.indexOf(this));
		point.circle=circle; circle.lines.push(this);
		point.a=a;
		this.update();
	}
	this.points=[];this.points.push({});this.points.push({});
	this.points[0].circle=circle1; this.points[0].a=a1;
	this.points[1].circle=circle2; this.points[1].a=a2;
	circle1.lines.push(this); circle2.lines.push(this);
	this.update();
}

function BigCircle(owner,type,subtype, d, r, a){
	this.draw = function(){
		var i;
		if(this.type==3 || this.type==1){
			var d, an;
			d=dist(this.x, this.y, midPoint, midPoint);
			an=Math.acos((mcR*mcR-d*d-this.r*this.r)/(-2*d*this.r));an=(PI/2-an)
			ctx.beginPath(); ctx.arc(this.x,this.y,this.r-lineWidth/2,0,PI*2);ctx.fillStyle="white"; ctx.fill();
			ctx.beginPath(); ctx.arc(this.x,this.y,this.r,this.a+PI/2+an,this.a+3/2*PI-an);ctx.stroke();
		}
		else{
			ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,2*PI); ctx.stroke();
		}
		
		if(this.type<5)
		{
			if(this.subtype==2 || this.subtype==3){		//DOTS
				var dotR, r, delta;
				for(i=2;i<this.subtype+2;i++){
					dotR=2+lineWidth/2, r=this.r-2.5*dotR, delta=(globalR/this.r)*i/3;
					ctx.beginPath();ctx.arc(this.x-Math.cos(this.a+delta)*r,this.y-Math.sin(this.a+delta)*r,dotR,0,PI*2);ctx.fillStyle="black"; ctx.fill();
				}
			}
		}
		
		if(dirtyRender){ctx.beginPath(); ctx.arc(this.x,this.y,3,0,PI*2);ctx.fillStyle="red"; ctx.fill();}
	}
	this.update=function(d, a){
		var dx, dy;
		var oldA=this.a;
		dx=Math.cos(a)*(d), dy=Math.sin(a)*(d);
		this.x=this.owner.x+dx;this.y=this.owner.y+dy;this.a=a;this.d=d;
		for(i=0;i<this.children.length;i++)
			this.children[i].update(this.children[i].d, this.children[i].a-oldA+this.a);
		for(i=0;i<this.lines.length;i++)
			this.lines[i].update();
	}
	this.owner=owner;
	this.children=[]; this.canHaveChildren=1; this.isAChild=false;
	this.type=type; this.subtype=subtype;
	this.nLines=0; this.lines=[];
	this.r = r;
	this.update(d, a);
}

function createFinalImage(){
	dirtyRender=0;
	redraw();
	var imgData=ctx.getImageData(0,0,canvasSize,canvasSize);
	for (var i=0;i<imgData.data.length;i+=4)
		if(imgData.data[i]==255 && imgData.data[i+1]==255 && imgData.data[i+2]==255) imgData.data[i+3]=0;	//converts white to transparency
	ctx.putImageData(imgData,0,0);
	var dataURL = canvas.toDataURL();
	document.location.href = dataURL;
	return;
}

$('canvas').click(function(e){
	var clickX = e.pageX-$(this).position().left, clickY = e.pageY-$(this).position().top;
	if(selectedCircle != -1) {selectedCircle=-1; redraw(); return;}
	if(selectedLine != -1) {selectedLine=-1; redraw(); return;}
	
	for(var i=0;i<buttons.length;++i){
		if(buttons[i].click(clickX, clickY)) return;
	}
	
	var i, j, k;
	var minD=20;
	for(i=0;i<allCircles.length;++i){
		var d=dist(allCircles[i].x, allCircles[i].y, clickX, clickY);
		if (d<minD){
			if(mainCircles.indexOf(allCircles[i])!=-1) continue; //don't select mainCircles for now
			if(allCircles[i].isAChild && [2, 3, 5].contains(allCircles[i].subtype)) continue; //unselectable - always overlap their parent
			minD=d;
			selectedCircle=allCircles[i];
			if (selectedCircle.isAChild) currentCircle=selectedCircle.owner.owner;
			else currentCircle=selectedCircle.owner;
		}
	}
	for(i=0;i<lines.length;++i){
		for(j=0;j<2;++j){
			var d=dist(lines[i].points[j].x, lines[i].points[j].y, clickX, clickY);
			if(d<minD){
			minD=d;
			selectedLine=lines[i];
			lineEnd=j;
			}
		}
	}
	if(selectedLine!=-1){selectedCircle=-1;}
});

$(document).on("contextmenu", "canvas", function(e){
   snapMode=!snapMode;
   redraw();
   return false;
});

function updateLocation(selected, d, a){
	if(!snapMode) {selected.update(d, a); return;}
	switch(selected.type){
		case 1:
			if(d>selected.owner.r-selected.r*0.5) d=selected.owner.r-selected.r*0.5;
			if(d<selected.owner.r-selected.r+1+lineWidth) d=selected.owner.r-selected.r+1+lineWidth;
			break;
		case 2:
			if(d>selected.owner.r-selected.r-5) d=selected.owner.r-selected.r-5;
			if(d<selected.r) d=selected.r;
			break;
		case 3:
			if(d>selected.owner.r+selected.r*0.8) d=selected.owner.r+selected.r*0.8;
			if(d<selected.owner.r) d=selected.owner.r;
			break;
		case 4:
			d=selected.owner.r;
			break;
		case 5:
			switch(selected.subtype){
				case 1:if(d<selected.owner.r+selected.r) d=selected.owner.r+selected.r;break;
				case 2:
				case 3:
				case 5:
					d=selected.owner.r;break;
				case 4:if(d>selected.owner.r-selected.r) d=selected.owner.r-selected.r;break;
			}break;
		case 6:
			switch(selected.subtype){ //TODO
				case 1:
					if(selected.owner.type==1){if(d<selected.r*2) d=selected.r*2; a=selected.owner.a;}
					if(selected.owner.type==2){if(d<selected.owner.r+selected.r) d=selected.owner.r+selected.r; a=selected.owner.a;}
					if(selected.owner.type==3){if(d<selected.owner.r/2) d=selected.owner.r/2; a=selected.owner.a;}
					if(selected.owner.type==4){if(d<selected.r) d=selected.r;
												if(d>selected.owner.r-selected.r) d=selected.owner.r-selected.r; a=selected.owner.a;}
					break;
				case 2:
				case 3:
				case 5:
					if(selected.owner.type==3) {d=selected.owner.d-selected.owner.owner.r; a=selected.owner.a+PI;}//locked
					else d=0;
					break;
				case 4:
					d=selected.owner.r;break;
			}break;
	}
	selected.update(d, a);
	for(i=0;i<selected.children.length;i++) updateLocation(selected.children[i], selected.children[i].d, selected.children[i].a);
}

$('canvas').mousemove(function(e){
	var moveX=e.pageX-$(this).position().left,moveY=e.pageY-$(this).position().top;
	if(moveY<30) return;
	if(selectedCircle != -1){
		var selected=selectedCircle;
		var a=Math.atan2(moveY-selected.owner.y,moveX-selected.owner.x);
		var d=dist(moveX, moveY, selected.owner.x, selected.owner.y);
		if(!selected.isAChild && currentCircle.children.length>2){
			var index=currentCircle.children.indexOf(selectedCircle);
			var splus=(index+1 >= currentCircle.children.length ? 0 : index+1),
				sminus=(index-1 < 0 ? currentCircle.children.length-1 : index-1);	//preserves order
			var aplus=currentCircle.children[splus].a,
				aminus=currentCircle.children[sminus].a;
			if(aplus>aminus) {a>0?aminus+=2*PI:aplus-=2*PI;}	//still buggy
			if(a<aplus) a=aplus;else if(a>aminus) a=aminus;
		}

		updateLocation(selected, d, a);
		redraw();
	}
	var i, a;
	if(selectedLine != -1){
		var selected=selectedLine;
		var minD=20;
		for(i=0;i<allCircles.length;++i){
			var d=dist(moveX, moveY, allCircles[i].x, allCircles[i].y)-allCircles[i].r; d=Math.abs(d);
			if(d<minD){
				minD=d;
				a=Math.atan2(moveY-allCircles[i].y,moveX-allCircles[i].x);
				selected.updatePoint(lineEnd, allCircles[i], a);
			}
		}
		redraw();
	}
});

$('canvas').mousewheel(function(event, delta, deltaX, deltaY){
	if(selectedCircle != -1){

		var selected=selectedCircle;
		var oldR=selected.r;
		if (delta > 0 || deltaX>0 || deltaY>0) selected.r+=1; else selected.r-=1;

		if(selected.type>=5)
			selected.r=selected.r<9?9:selected.r;
		else
			selected.r=selected.r<mcR*0.1?mcR*0.1:selected.r;
		
		for(i=0;i<selected.children.length;i++) selected.children[i].update(selected.children[i].d-oldR+selected.r, selected.children[i].a);
		updateLocation(selected, selected.d, selected.a);
		redraw();
	}
	return false;
});

function drawAngles(){
	var index=currentCircle.children.indexOf(selectedCircle);
	var splus=(index+1 >= currentCircle.children.length ? 0 : index+1),
		sminus=(index-1 < 0 ? currentCircle.children.length-1 : index-1);	//preserves order
	ctx.strokeStyle="red";
	ctx.beginPath(); ctx.moveTo(midPoint,midPoint);
	ctx.lineTo(midPoint+Math.cos(currentCircle.children[splus].a)*(mcR*1.3), midPoint+Math.sin(currentCircle.children[splus].a)*(mcR*1.3));
	ctx.moveTo(midPoint,midPoint);
	ctx.lineTo(midPoint+Math.cos(currentCircle.children[sminus].a)*(mcR*1.3), midPoint+Math.sin(currentCircle.children[sminus].a)*(mcR*1.3));ctx.stroke();
	ctx.strokeStyle="black";
}

var map={"b":1,"ch":2,"d":3,"f":4,"g":5,"h":6,
		"j":1,"k":2,"l":3,"m":4,"n":5,"p":6,
		"t":1,"sh":2,"r":3,"s":4,"v":5,"w":6,
		"th":1,"y":2,"z":3,"nq":4,"qu":5,"x":6,
		"a":1,"e":2,"i":3,"o":4,"u":5};

function generateWord(word){
	var delta=2*PI/wordL;
	var angle=PI/2;
	globalR=1.8*mcR/(wordL+2);
	
	var i;
	var owner, newCircle;
	
	var newMainCircle = new BigCircle({x:midPoint, y:midPoint, a:0}, 4,0,0, mcR, 0);
	
	mainCircles.push(newMainCircle);
	allCircles.push(newMainCircle);
	
	for(var i=0;i<word.length;i++)
	{
		letter=word[i];
		owner=newMainCircle;
		
		if(i>0)angle-=delta;if(angle<-PI) angle+=2*PI;
		
		var type=0, r=0, d=0;
		var subtype=map[letter];
		var nLines=[0, 0, 0, 3, 1, 2][subtype-1];
		if(letter.match("^(b|ch|d|f|g|h)$")){
			type=1,r=globalR,d=mcR-r+1;
			newCircle = new BigCircle(owner,type,subtype, d, r, angle);
		}
		if(letter.match("^(j|k|l|m|n|p)$")){
			type=2,r=globalR,d=mcR-r-5;
			newCircle = new BigCircle(owner,type,subtype, d, r, angle);
		}
		if(letter.match("^(t|sh|r|s|v|w)$")){
			type=3,r=globalR*1.3,d=mcR*1.1;
			newCircle = new BigCircle(owner,type,subtype, d, r, angle);
		}
		if(letter.match("^(th|y|z|ng|qu|x)$")){
			type=4,r=globalR,d=mcR;
			newCircle = new BigCircle(owner,type,subtype, d, r, angle);
		}
		if(letter.match("(a|e|i|o|u)")){
			nLines=[0, 0, 1, 0, 1][subtype-1];
			r=mcR*0.05;
			if(i!=0 && owner.children[owner.children.length-1].canHaveChildren==1){
				type=6;
				owner=owner.children[owner.children.length-1]
				angle=owner.a;
				newCircle=new BigCircle(owner, type, subtype, owner.r/2, r, owner.a+PI+PI/8);
				newCircle.isAChild=true;
				newCircle.canHaveChildren=0;
				owner.canHaveChildren=0;
			}
			else{
				type=5, d=mcR;
				newCircle=new BigCircle(owner, type, subtype,owner.r, r, angle);
				newCircle.canHaveChildren=0;
			}
		}
		newCircle.nLines=nLines;
		updateLocation(newCircle, newCircle.d, newCircle.a);
		owner.children.push(newCircle);
		
		allCircles.push(newCircle);
	}
	
	createLines();
	
	redraw();
}

function createLines(){
	//temporary
	if(mainCircles[0].children.length>3){
		lines.push(new Line(mainCircles[0].children[1], -PI/2, mainCircles[0].children[2], PI/2));
	}
}

function drawGUI(){
	for(var i=0;i<buttons.length;++i){
		buttons[i].draw();
	}
	ctx.fillText("(left click) edit mode: "+((selectedCircle==-1 && selectedLine==-1)?"no":"yes"),10,canvasSize-50);
	ctx.fillText("(right click) will snap according to rules: "+(snapMode?"yes":"no"),10,canvasSize-20);
}

function redraw(){
	//ctx.setTransform(1,0,0,1,0,0);	//TODO
	ctx.lineWidth=lineWidth;
	ctx.clearRect(0,0,canvasSize,canvasSize);
	for(var i=0;i<allCircles.length;++i){
		allCircles[i].draw();
	}
	for(var i=0;i<lines.length;++i){
		lines[i].draw();
	}
	if(mainCircles.length){ctx.beginPath(); ctx.arc(midPoint, midPoint,outerR,0,PI*2);ctx.stroke();}
	if(selectedCircle!=-1 && !selectedCircle.isAChild) drawAngles();
	if(dirtyRender) {ctx.lineWidth=1; drawGUI();}
}