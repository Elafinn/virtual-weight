/* global AFRAME, THREE */

/**
* Handles events coming from the hand-controls.
* Determines if the entity is grabbed or released.
* Updates its position to move along the controller.
*/
AFRAME.registerComponent('multigrab', {

  init: function () {
	console.log('init');
    this.GRABBED_STATE = 'grabbed';
    // Bind event handlers
    this.onHit = this.onHit.bind(this);
    this.onGripOpen = this.onGripOpen.bind(this);
    this.onGripClose = this.onGripClose.bind(this);
  },

  play: function () {
	console.log("play");
    var el = this.el;
    el.addEventListener('hit', this.onHit);
    //el.addEventListener('gripdown', this.onGripClose);
    //el.addEventListener('gripup', this.onGripOpen);
    el.addEventListener('buttondown', this.onGripClose);
    el.addEventListener('buttonup', this.onGripOpen);
  },

  pause: function () {
	console.log("pause");
    var el = this.el;
    el.removeEventListener('hit', this.onHit);
    //el.removeEventListener('gripdown', this.onGripClose);
    //el.removeEventListener('gripup', this.onGripOpen);
    el.removeEventListener('buttondown', this.onGripClose);
    el.removeEventListener('buttonup', this.onGripOpen);
  },

  onGripClose: function (evt) {
    this.grabbing = true;
	console.log("I'm trying to grip");
    delete this.previousPosition;
  },

  onGripOpen: function (evt) {
    var hitEl = this.hitEl;
    this.grabbing = false;
	console.log("No longer trying to grip");
    if (!hitEl) { return; }
    hitEl.removeState(this.GRABBED_STATE);
    this.hitEl = undefined;
  },

  onHit: function (evt) {
    var hitEl = evt.detail.el;
    // If the element is already grabbed (it could be grabbed by another controller).
    // If the hand is not grabbing the element does not stick.
    // If we're already grabbing something you can't grab again.
    if (!hitEl || hitEl.is(this.GRABBED_STATE) || !this.grabbing || this.hitEl) { return; }
	hitEl.addState(this.GRABBED_STATE);
    this.hitEl = hitEl;
	var controllerPos = this.el.getAttribute('position');
	var objPos = hitEl.getAttribute('position');
    this.dragOffset = {
		x: objPos.x - controllerPos.x,
		y: objPos.y - controllerPos.y,
		z: objPos.z - controllerPos.z
	};
	this.velocity = {
		x: 0, y: 0, z: 0
	};
  },
  
  pulse: function (force, dur) {
	this.el.components["tracked-controls"].controller.hapticActuators[0].pulse(force,dur);
  },  

  tick: function () {
    var hitEl = this.hitEl;
    var position;
    if (!hitEl) { return; }

	grabtype = hitEl.getAttribute('grabtype');
	if(grabtype == "weightless")
	{
		this.updateDelta();
		position = hitEl.getAttribute('position');
		hitEl.setAttribute('position', {
			x: position.x + this.deltaPosition.x,
			y: position.y + this.deltaPosition.y,
			z: position.z + this.deltaPosition.z
		});
	}
	else if(grabtype == "grabprop")
	{
		var weight = hitEl.getAttribute('grabweight');
		this.updateDelta();
		position = hitEl.getAttribute('position');
		var prop = 1.0 - weight;
		hitEl.setAttribute('position', {
			x: position.x + prop * this.deltaPosition.x,
			y: position.y + prop * this.deltaPosition.y,
			z: position.z + prop * this.deltaPosition.z
		});
	}
	else if(grabtype == "grabhap")
	{
		var weight = hitEl.getAttribute('grabweight');
		this.updateDelta();
		position = hitEl.getAttribute('position');
		hitEl.setAttribute('position', {
			x: position.x + this.deltaPosition.x,
			y: position.y + this.deltaPosition.y,
			z: position.z + this.deltaPosition.z
		});
		var dx = this.deltaPosition.x;
		var dy = this.deltaPosition.y;
		var dz = this.deltaPosition.z;
		var velocity = Math.sqrt(dx*dx + dy*dy + dz*dz);
		//var max_velocity = 0.005556*weight*weight + 0.05389*weight + 0.04056;
		//var max_velocity = 49.26*weight*weight - 22.22*weight + 0.8222;
		var max_velocity = -0.04833333*weight+0.039666666;
		var pct_vel = velocity/max_velocity;
		if (pct_vel > 1) {
			pct_vel = 1;
		}
		var force = pct_vel*2 - 1.0;
		if( force > 0 )
			this.pulse(force, 10);
		//console.log("max: " + max_velocity + ", curr: " + velocity + ", force: " + force);
		if(velocity > max_velocity)
		{
			// Drop
			console.log("Drop");
			this.onGripOpen();
		}
		
	}
	else if(grabtype == "grabfollow")
	{
		var weight = hitEl.getAttribute('grabweight');
		this.updateDelta();
		position = hitEl.getAttribute('position');
		var mweight = 1.0 - weight;
		var prop = mweight * mweight * 0.2;
		var controllerPos = this.el.getAttribute('position');
		var target = {
			x: controllerPos.x + this.dragOffset.x,
			y: controllerPos.y + this.dragOffset.y,
			z: controllerPos.z + this.dragOffset.z
		}
		hitEl.setAttribute('position', {
			x: (1.0-prop) * position.x + prop * target.x,
			y: (1.0-prop) * position.y + prop * target.y,
			z: (1.0-prop) * position.z + prop * target.z
		});
	}
	else if(grabtype == "grabforce")
	{
		var weight = hitEl.getAttribute('grabweight');
		this.updateDelta();
		position = hitEl.getAttribute('position');
		var controllerPos = this.el.getAttribute('position');
		var target = {
			x: controllerPos.x + this.dragOffset.x,
			y: controllerPos.y + this.dragOffset.y,
			z: controllerPos.z + this.dragOffset.z
		}
		// Update velocity
		var v = this.velocity;
		//rigidBody.AddForceAtPosition((positionTarget - wCollisionOffset).normalized / (rigidBody.mass * .01f), wCollisionOffset);
		var dx = target.x - position.x;
		var dy = target.y - position.y;
		var dz = target.z - position.z;
		var veclen = Math.sqrt(dx*dx + dy*dy + dz*dz);
		if(veclen > 0)
		{
			var f = {
				x: (dx/veclen) / (weight * weight * 2000),
				y: (dy/veclen) / (weight * weight * 2000),
				z: (dz/veclen) / (weight * weight * 2000)
			};
			
			console.log(veclen);
			if(veclen < 1.0)
			{
				f.x *= veclen;
				f.y *= veclen;
				f.z *= veclen;
			}
			//v = v + f;

			v = {
				x: v.x*0.95 + f.x,
				y: v.y*0.95 + f.y,
				z: v.z*0.95 + f.z
			};

			this.velocity = v;
		}
		
		// Apply velocity
		hitEl.setAttribute('position', {
			x: position.x + v.x,
			y: position.y + v.y,
			z: position.z + v.z
		});
	}
  },

  updateDelta: function () {
    var currentPosition = this.el.getAttribute('position');
    if (!this.previousPosition) {
      this.previousPosition = new THREE.Vector3();
      this.previousPosition.copy(currentPosition);
    }
    var previousPosition = this.previousPosition;
	var startPosition = this.startPosition;
    var deltaPosition = {
      x: currentPosition.x - previousPosition.x,
      y: currentPosition.y - previousPosition.y,
      z: currentPosition.z - previousPosition.z
    };
    this.previousPosition.copy(currentPosition);
    this.deltaPosition = deltaPosition;
  }
});
