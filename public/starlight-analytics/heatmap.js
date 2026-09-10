(function(global){
  "use strict";
  const palette=[
    [0,"rgba(238,40,40,.98)"],[.2,"rgba(255,130,30,.92)"],[.42,"rgba(255,226,65,.82)"],
    [.64,"rgba(54,216,151,.58)"],[.82,"rgba(34,113,255,.34)"],[1,"rgba(30,92,255,0)"],
  ];
  class StarlightHeatmap{
    constructor(canvas,onSelect){this.canvas=canvas;this.ctx=canvas.getContext("2d");this.onSelect=onSelect;this.points=[];this.type="all";this.clickHandler=(event)=>this.select(event);this.resizeHandler=()=>this.resize();this.resize();canvas.addEventListener("click",this.clickHandler);window.addEventListener("resize",this.resizeHandler);}
    resize(){const box=this.canvas.getBoundingClientRect();const ratio=window.devicePixelRatio||1;this.canvas.width=Math.max(1,Math.round(box.width*ratio));this.canvas.height=Math.max(1,Math.round(box.height*ratio));this.draw();}
    setPoints(points,type="all"){this.points=points||[];this.type=type;this.draw();}
    draw(){if(!this.ctx)return;const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;ctx.clearRect(0,0,w,h);if(!this.points.length)return;const max=Math.max(...this.points.map((point)=>point.count||1));const dwellMax=Math.max(...this.points.map((point)=>point.average_elapsed_time||1));ctx.globalCompositeOperation="lighter";for(const point of this.points){const weight=this.type==="dwell"?(point.average_elapsed_time||0)/dwellMax:(point.count||1)/max;const radius=Math.max(14,Math.min(w,h)*(.045+.045*Math.sqrt(weight)));const x=point.x*w,y=point.y*h;const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);for(const [stop,color] of palette)gradient.addColorStop(stop,color);ctx.globalAlpha=.1+.3*Math.sqrt(weight);ctx.fillStyle=gradient;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);}ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";}
    select(event){if(!this.points.length)return;const box=this.canvas.getBoundingClientRect();const x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;let nearest=null,distance=Infinity;for(const point of this.points){const next=Math.hypot(point.x-x,point.y-y);if(next<distance){nearest=point;distance=next;}}if(nearest&&distance<.13)this.onSelect?.(nearest);}
    destroy(){this.canvas.removeEventListener("click",this.clickHandler);window.removeEventListener("resize",this.resizeHandler);}
  }
  global.StarlightHeatmap=StarlightHeatmap;
})(window);
