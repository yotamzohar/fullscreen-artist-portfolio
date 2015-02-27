// Utility for creating objects in older browsers
if ( typeof Object.create !== 'function' ) {
  Object.create = function( obj ) {

    function F() {}
    F.prototype = obj;
    return new F();

  };
}

/*!
 * jQuery panelSnap
 * Version 0.10.0
 *
 * Requires:
 * - jQuery 1.7.1 or higher (no jQuery.migrate needed)
 *
 * https://github.com/guidobouman/jquery-panelsnap
 *
 * Copyright 2013, Guido Bouman
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Date: Wed Feb 13 16:05:00 2013 +0100
 */
(function($, window, document, undefined) {

/*!
 * Plug in start
 */

  var pluginName = 'panelSnap';
  var storageName = 'plugin_' + pluginName;

  var pluginObject = {

    isMouseDown: false,
    isSnapping: false,
    enabled: true,
    scrollInterval: 0,
    scrollOffset: 0,

    init: function(options, container) {

      var self = this;

      self.$window = $(window);
      self.$document = $(document);

      self.container = container;
      self.$container = $(container);

      self.$eventContainer = self.$container;
      self.$snapContainer = self.$container;3

      self.scrollInterval = self.$container.height();

      self.options = $.extend(true, {}, $.fn.panelSnap.options, options);

      self.bind();

      if(self.options.$menu !== false && $('.active', self.options.$menu).length > 0) {
        $('.active', self.options.$menu).click();
      } else {
        var $target = self.getPanel(':first');
        self.activatePanel($target);
      }

      return self;

    },

    bind: function() {

      var self = this;

      self.bindProxied(self.$eventContainer, 'scrollstop', self.scrollStop);
      self.bindProxied(self.$eventContainer, 'mousewheel', self.mouseWheel);
      self.bindProxied(self.$eventContainer, 'mousedown', self.mouseDown);
      self.bindProxied(self.$eventContainer, 'mouseup', self.mouseUp);

      self.bindProxied(self.$window, 'resizestop', self.resize);

      if(self.options.$menu !== false) {
        self.bindProxied($(self.options.$menu), 'click', self.captureMenuClick, self.options.menuSelector);
      }

    },

    bindProxied: function($element, event, method, selector) {

      var self = this;

      selector = typeof selector === 'string' ? selector : null;

      $element.on(event + self.options.namespace, selector, $.proxy(function(e) {

        return method.call(self, e);

      }, self));

    },

    destroy: function() {

      var self = this;

      // Gotta love namespaced events!
      self.$eventContainer.off(self.options.namespace);

      self.$window.off(self.options.namespace);

      if(self.options.$menu !== false) {
        $(self.options.menuSelector, self.options.$menu).off(self.options.namespace);
      }

      self.$container.removeData(storageName);

    },

    scrollStop: function(e) {

      var self = this;

      e.stopPropagation();

      if(!self.enabled) {
        return;
      }

      if(self.isMouseDown) {
        self.$eventContainer.one('mouseup' + self.options.namespace, self.processScroll);
        return;
      }

      if(self.isSnapping) {
        return;
      }

      var offset = self.$eventContainer.scrollTop();
      var scrollDifference = offset - self.scrollOffset;
      var maxOffset = self.$container[0].scrollHeight - self.scrollInterval;
      var panelCount = self.getPanel().length;

      var childNumber;
      if(
        scrollDifference < -self.options.directionThreshold &&
        scrollDifference > -self.scrollInterval
      ) {
        childNumber = Math.floor(offset / self.scrollInterval);
      } else if(
        scrollDifference > self.options.directionThreshold &&
        scrollDifference < self.scrollInterval
      ) {
        childNumber = Math.ceil(offset / self.scrollInterval);
      } else {
        childNumber = Math.round(offset / self.scrollInterval);
      }

      childNumber = Math.max(0, Math.min(childNumber, panelCount));

      var $target = self.getPanel(':eq(' + childNumber + ')');

      if(scrollDifference === 0) {
        // Do nothing
      } else if (offset < 0 || offset > maxOffset) {
        // Only activate, prevent stuttering
        self.activatePanel($target);
        // Set scrollOffset to a sane number for next scroll
        self.scrollOffset = offset < 0 ? 0 : maxOffset;
      } else {
        self.snapToPanel($target);
      }

    },

    mouseWheel: function(e) {

      var self = this;

      // This event only fires when the user actually scrolls with their input device.
      // Be it a trackpad, legacy mouse or anything else.

      self.$container.stop(true);
      self.isSnapping = false;

    },

    mouseDown: function(e) {

      var self = this;

      self.isMouseDown = true;

    },

    mouseUp: function(e) {

      var self = this;

      self.isMouseDown = false;

    },

    resize: function(e) {

      var self = this;

      self.scrollInterval = self.$container.height();

      if(!self.enabled) {
        return;
      }

      var $target = self.getPanel('.active');

      self.snapToPanel($target);

    },

    captureMenuClick: function(e) {

      var self = this;

      var panel = $(e.currentTarget).data('panel');
      var $target = self.getPanel('[data-panel=' + panel + ']');

      self.snapToPanel($target);

      return false;

    },

    snapToPanel: function($target) {

      var self = this;

      self.isSnapping = true;

      self.options.onSnapStart.call(self, $target);
      self.$container.trigger('panelsnap:start', [$target]);

      var scrollTarget = 0;
      if(self.$container.is('body')) {
        scrollTarget = $target.offset().top;
      } else {
        scrollTarget = self.$eventContainer.scrollTop() + $target.position().top;
      }

      self.$snapContainer.stop(true).animate({
        scrollTop: scrollTarget
      }, self.options.slideSpeed, function() {

        self.scrollOffset = scrollTarget;
        self.isSnapping = false;

        // Call callback
        self.options.onSnapFinish.call(self, $target);
        self.$container.trigger('panelsnap:finish', [$target]);

      });

      self.activatePanel($target);

    },

    activatePanel: function($target) {

      var self = this;

      self.getPanel('.active').removeClass('active');
      $target.addClass('active');

      if(self.options.$menu !== false) {
        var activeItemSelector = '> ' + self.options.menuSelector + '.active';
        $(activeItemSelector, self.options.$menu).removeClass('active');

        var attribute = '[data-panel=' + $target.data('panel') + ']';
        var itemSelector = '> ' + self.options.menuSelector + attribute;
        var $itemToActivate = $(itemSelector, self.options.$menu);
        $itemToActivate.addClass('active');
      }

      self.options.onActivate.call(self, $target);
      self.$container.trigger('panelsnap:activate', [$target]);

    },

    getPanel: function(selector) {

      var self = this;

      if(typeof selector === 'undefined') {
        selector = '';
      }

      var panelSelector = '> ' + self.options.panelSelector + selector;
      return $(panelSelector, self.$container);

    },

    snapTo: function(target, wrap) {

      var self = this;

      if(typeof wrap !== 'boolean') {
        wrap = true;
      }

      var $target;

      switch(target) {
        case 'prev':

          $target = self.getPanel('.active').prev(self.options.panelSelector);
          if($target.length < 1 && wrap)
          {
            $target = self.getPanel(':last');
          }
          break;

        case 'next':

          $target = self.getPanel('.active').next(self.options.panelSelector);
          if($target.length < 1 && wrap)
          {
            $target = self.getPanel(':first');
          }
          break;

        case 'first':

          $target = self.getPanel(':first');
          break;

        case 'last':

          $target = self.getPanel(':last');
          break;
      }

      if($target.length > 0) {
        self.snapToPanel($target);
      }

    },

    enable: function() {

      var self = this;

      // Gather scrollOffset for next scroll
      self.scrollOffset = self.$container[0].scrollHeight;

      self.enabled = true;

    },

    disable: function() {

      var self = this;

      self.enabled = false;

    },

    toggle: function() {

      var self = this;

      if(self.enabled) {
        self.disable();
      } else {
        self.enable();
      }

    }

  };

  $.fn[pluginName] = function(options) {

    var args = Array.prototype.slice.call(arguments);

    return this.each(function() {

      var pluginInstance = $.data(this, storageName);
      if(typeof options === 'object' || options === 'init' || ! options) {
        if(!pluginInstance) {
          if(options === 'init') {
            options = args[1] || {};
          }

          pluginInstance = Object.create(pluginObject).init(options, this);
          $.data(this, storageName, pluginInstance);
        } else {
          $.error('Plugin is already initialized for this object.');
          return;
        }
      } else if(!pluginInstance) {
        $.error('Plugin is not initialized for this object yet.');
        return;
      } else if(pluginInstance[options]) {
        var method = options;
        options = args.slice(1);
        pluginInstance[method].apply(pluginInstance, options);
      } else {
        $.error('Method ' +  options + ' does not exist on jQuery.panelSnap.');
        return;
      }

    });

  };

  $.fn[pluginName].options = {
    $menu: false,
    menuSelector: 'a',
    panelSelector: '.box',
    namespace: '.panelSnap',
    onSnapStart: function(){},
    onSnapFinish: function(){},
    onActivate: function(){},
    directionThreshold: 100,
    slideSpeed: 400
  };

})(jQuery, window, document);

/*!
 * Special flavoured jQuery Mobile scrollstart & scrollstop events.
 * Version 0.1.3
 *
 * Requires:
 * - jQuery 1.7.1 or higher (no jQuery.migrate needed)
 *
 * Copyright 2013, Guido Bouman
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Date: Wed Feb 13 16:05:00 2013 +0100
 */
(function($) {

  // Also handles the scrollstop event
  $.event.special.scrollstart = {

    enabled: true,

    setup: function() {

      var thisObject = this;
      var $this = $(thisObject);
      var scrolling;
      var timer;

      $this.data('scrollwatch', true);

      function trigger(event, scrolling) {

        event.type = scrolling ? "scrollstart" : "scrollstop";
        $this.trigger(event);

      }

      $this.on("touchmove scroll", function(event) {

        if(!$.event.special.scrollstart.enabled) {
          return;
        }

        if(!$.event.special.scrollstart.scrolling) {
          $.event.special.scrollstart.scrolling = true;
          trigger(event, true);
        }

        clearTimeout(timer);
        timer = setTimeout(function() {
          $.event.special.scrollstart.scrolling = false;
          trigger(event, false);
        }, 50);

      });

    }

  };

  // Proxies scrollstart when needed
  $.event.special.scrollstop = {

    setup: function() {

      var thisObject = this;
      var $this = $(thisObject);

      if(!$this.data('scrollwatch')) {
        $(this).on('scrollstart', function(){});
      }

    }

  };

})(jQuery);

/*!
 * Resizestart and resizestop events.
 * Version 0.0.1
 *
 * Requires:
 * - jQuery 1.7.1 or higher (no jQuery.migrate needed)
 *
 * Copyright 2013, Guido Bouman
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Date: Fri Oct 25 15:05:00 2013 +0100
 */
(function($) {

  // Also handles the resizestop event
  $.event.special.resizestart = {

    enabled: true,

    setup: function() {

      var thisObject = this;
      var $this = $(thisObject);
      var resizing;
      var timer;

      $this.data('resizewatch', true);

      function trigger(event, resizing) {

        event.type = resizing ? "resizestart" : "resizestop";
        $this.trigger(event);

      }

      $this.on("resize", function(event) {

        if(!$.event.special.resizestart.enabled) {
          return;
        }

        if(!$.event.special.resizestart.resizing) {
          $.event.special.resizestart.resizing = true;
          trigger(event, true);
        }

        clearTimeout(timer);
        timer = setTimeout(function() {
          $.event.special.resizestart.resizing = false;
          trigger(event, false);
        }, 200);

      });

    }

  };

  // Proxies resizestart when needed
  $.event.special.resizestop = {

    setup: function() {

      var thisObject = this;
      var $this = $(thisObject);

      if(!$this.data('resizewatch')) {
        $(this).on('resizestart', function(){});
        $(this).on('resizestop', function(){$('.box').resizeSlides();});

      }

    }

  };

})(jQuery);

/*! Copyright (c) 2011 Brandon Aaron (http://brandonaaron.net)
 * Licensed under the MIT License (LICENSE.txt).
 *
 * Thanks to: http://adomas.org/javascript-mouse-wheel/ for some pointers.
 * Thanks to: Mathias Bank(http://www.mathias-bank.de) for a scope bug fix.
 * Thanks to: Seamus Leahy for adding deltaX and deltaY
 *
 * Version: 3.0.6
 *
 * Requires: 1.2.2+
 */
(function($) {

  var types = ['DOMMouseScroll', 'mousewheel'];

  if ($.event.fixHooks) {
    for ( var i=types.length; i; ) {
      $.event.fixHooks[ types[--i] ] = $.event.mouseHooks;
    }
  }

  $.event.special.mousewheel = {
    setup: function() {
      if ( this.addEventListener ) {
        for ( var i=types.length; i; ) {
          this.addEventListener( types[--i], handler, false );
        }
      } else {
        this.onmousewheel = handler;
      }
    },

    teardown: function() {
      if ( this.removeEventListener ) {
        for ( var i=types.length; i; ) {
          this.removeEventListener( types[--i], handler, false );
        }
      } else {
        this.onmousewheel = null;
      }
    }
  };

  $.fn.extend({
    mousewheel: function(fn) {
      return fn ? this.bind("mousewheel", fn) : this.trigger("mousewheel");
    },

    unmousewheel: function(fn) {
      return this.unbind("mousewheel", fn);
    }
  });

  function handler(event) {
    var orgEvent = event || window.event,
        args = [].slice.call( arguments, 1 ),
        delta = 0,
        returnValue = true,
        deltaX = 0,
        deltaY = 0;

    event = $.event.fix(orgEvent);
    event.type = "mousewheel";

    // Old school scrollwheel delta
    if ( orgEvent.wheelDelta ) { delta = orgEvent.wheelDelta/120; }
    if ( orgEvent.detail     ) { delta = -orgEvent.detail/3; }

    // New school multidimensional scroll (touchpads) deltas
    deltaY = delta;

    // Gecko
    if ( orgEvent.axis !== undefined && orgEvent.axis === orgEvent.HORIZONTAL_AXIS ) {
      deltaY = 0;
      deltaX = -1*delta;
    }

    // Webkit
    if ( orgEvent.wheelDeltaY !== undefined ) { deltaY = orgEvent.wheelDeltaY/120; }
    if ( orgEvent.wheelDeltaX !== undefined ) { deltaX = -1*orgEvent.wheelDeltaX/120; }

    // Add event and delta to the front of the arguments
    args.unshift(event, delta, deltaX, deltaY);

    return ($.event.dispatch || $.event.handle).apply(this, args);
  }

})(jQuery);     


$.fn.resizeSlides = function() {

      var self = $(this),
          win = $(window),
          box = $('.fullscreen-slider, .fullscreen-slider .panels, .fullscreen-slider .panels .box'),
          img = $('.fullscreen-slider .panels .box > img'),
          ratio = .7,
          w = win.width(),
          h = win.height();

        if ((h/w) > ratio) {
            self.height(h);
            self.width(h / ratio);
            img.height(h);
            img.width(h / ratio);
   
        } else {
            self.width(w);
            self.height(w * ratio);
            img.width(w);
            img.height(w * ratio);
        }

        img.css('left', (w - self.width())/2);
        img.css('top', (h - self.height())/2);
        box.css('height', h +'px');
        box.css('width', w +'px');

 }; 

     $('a.nav').click(function(e){
        e.preventDefault();
        $('body').toggleClass('open'); 
     });

    $('a.close').click(function(){

        $('body').removeClass('openwide'); 

     });



    /*---------------------------------------------------------------------------------------------

@author       Constantin Saguin - @brutaldesign
@link            http://csag.co
@github        http://github.com/brutaldesign/swipebox
@version     1.2.1
@license      MIT License

----------------------------------------------------------------------------------------------*/

;(function (window, document, $, undefined) {
  
  $.swipebox = function(elem, options) {

    var defaults = {
      useCSS : true,
      initialIndexOnArray : 0,
      hideBarsDelay : 3000,
      videoMaxWidth : 1140,
      vimeoColor : 'CCCCCC',
      beforeOpen: null,
            afterClose: null
    },
    
    plugin = this,
    elements = [], // slides array [{href:'...', title:'...'}, ...],
    elem = elem,
    selector = elem.selector,
    $selector = $(selector),
    isTouch = document.createTouch !== undefined || ('ontouchstart' in window) || ('onmsgesturechange' in window) || navigator.msMaxTouchPoints,
    supportSVG = !!(window.SVGSVGElement),
    winWidth = window.innerWidth ? window.innerWidth : $(window).width(),
    winHeight = window.innerHeight ? window.innerHeight : $(window).height(),
    html = '<div id="swipebox-overlay">\
        <div id="swipebox-slider"></div>\
        <div id="swipebox-caption"></div>\
        <div id="swipebox-action">\
          <a id="swipebox-close"></a>\
          <a id="swipebox-prev"></a>\
          <a id="swipebox-next"></a>\
        </div>\
    </div>';

    plugin.settings = {}

    plugin.init = function(){

      plugin.settings = $.extend({}, defaults, options);

      if ($.isArray(elem)) {

        elements = elem;
        ui.target = $(window);
        ui.init(plugin.settings.initialIndexOnArray);

      }else{

        $selector.click(function(e){

          elements = [];
          var index , relType, relVal;

          if (!relVal) {
            relType = 'rel';
            relVal  = $(this).attr(relType);
          }

          if (relVal && relVal !== '' && relVal !== 'nofollow') {
            $elem = $selector.filter('[' + relType + '="' + relVal + '"]');
          }else{
            $elem = $(selector);
          }

          $elem.each(function(){

            var title = null, href = null;
            
            if( $(this).attr('title') )
              title = $(this).attr('title');

            if( $(this).attr('href') )
              href = $(this).attr('href');

            elements.push({
              href: href,
              title: title
            });
          });
          
          index = $elem.index($(this));
          e.preventDefault();
          e.stopPropagation();
          ui.target = $(e.target);
          ui.init(index);
        });
      }
    }

    plugin.refresh = function() {
      if (!$.isArray(elem)) {
        ui.destroy();
        $elem = $(selector);
        ui.actions();
      }
    }

    var ui = {

      init : function(index){
        if (!$.swipebox.isOpen) {
          if (plugin.settings.beforeOpen) 
            plugin.settings.beforeOpen();
          this.target.trigger('swipebox-start');
          $.swipebox.isOpen = true;
          this.build();
          this.openSlide(index);
          this.openMedia(index);
          this.preloadMedia(index+1);
          this.preloadMedia(index-1);
        } else {
          this.setSlide(index);
          this.preloadMedia(index);
          this.preloadMedia(index+1);
          this.preloadMedia(index-1);
        }
      },

      build : function(){

        var $this = this;

        $('body').append(html);

        if($this.doCssTrans()){
          $('#swipebox-slider').css({
            '-webkit-transition' : 'left 0.4s ease',
            '-moz-transition' : 'left 0.4s ease',
            '-o-transition' : 'left 0.4s ease',
            '-khtml-transition' : 'left 0.4s ease',
            'transition' : 'left 0.4s ease'
          });
          $('#swipebox-overlay').css({
            '-webkit-transition' : 'opacity 1s ease',
            '-moz-transition' : 'opacity 1s ease',
            '-o-transition' : 'opacity 1s ease',
            '-khtml-transition' : 'opacity 1s ease',
            'transition' : 'opacity 1s ease'
          });
          $('#swipebox-action, #swipebox-caption').css({
            '-webkit-transition' : '0.5s',
            '-moz-transition' : '0.5s',
            '-o-transition' : '0.5s',
            '-khtml-transition' : '0.5s',
            'transition' : '0.5s'
          });
        }


        if(supportSVG){
          var bg = $('#swipebox-action #swipebox-close').css('background-image');
          bg = bg.replace('png', 'svg');
          $('#swipebox-action #swipebox-prev,#swipebox-action #swipebox-next,#swipebox-action #swipebox-close').css({
            'background-image' : bg
          });
        }
        
        $.each( elements,  function(){
          $('#swipebox-slider').append('<div class="slide"></div>');
        });

        $this.setDim();
        $this.actions();
        $this.keyboard();
        $this.gesture();
        $this.animBars();
        $this.resize();
        
      },

      setDim : function(){

        var width, height, sliderCss = {};
        
        if( "onorientationchange" in window ){

          window.addEventListener("orientationchange", function() {
            if( window.orientation == 0 ){
              width = winWidth;
              height = winHeight;
            }else if( window.orientation == 90 || window.orientation == -90 ){
              width = winHeight;
              height = winWidth;
            }
          }, false);
          
        
        }else{

          width = window.innerWidth ? window.innerWidth : $(window).width();
          height = window.innerHeight ? window.innerHeight : $(window).height();
        }

        sliderCss = {
          width : width,
          height : height
        }


        $('#swipebox-overlay').css(sliderCss);

      },

      resize : function (){
        var $this = this;
        
        $(window).resize(function() {
          $this.setDim();
        }).resize();
      },

      supportTransition : function() {
        var prefixes = 'transition WebkitTransition MozTransition OTransition msTransition KhtmlTransition'.split(' ');
        for(var i = 0; i < prefixes.length; i++) {
          if(document.createElement('div').style[prefixes[i]] !== undefined) {
            return prefixes[i];
          }
        }
        return false;
      },

      doCssTrans : function(){
        if(plugin.settings.useCSS && this.supportTransition() ){
          return true;
        }
      },

      gesture : function(){
        if ( isTouch ){
          var $this = this,
          distance = null,
          swipMinDistance = 10,
          startCoords = {},
          endCoords = {};
          var bars = $('#swipebox-caption, #swipebox-action');

          bars.addClass('visible-bars');
          $this.setTimeout();

          $('body').bind('touchstart', function(e){

            $(this).addClass('touching');

              endCoords = e.originalEvent.targetTouches[0];
                startCoords.pageX = e.originalEvent.targetTouches[0].pageX;

            $('.touching').bind('touchmove',function(e){
              e.preventDefault();
              e.stopPropagation();
                  endCoords = e.originalEvent.targetTouches[0];

            });
                      
                      return false;

                  }).bind('touchend',function(e){
                    e.preventDefault();
          e.stopPropagation();
          
            distance = endCoords.pageX - startCoords.pageX;
                
                if( distance >= swipMinDistance ){
                  
                  // swipeLeft
                  $this.getPrev();
                
                }else if( distance <= - swipMinDistance ){
                  
                  // swipeRight
                  $this.getNext();
                
                }else{
                  // tap
                  if(!bars.hasClass('visible-bars')){
              $this.showBars();
              $this.setTimeout();
            }else{
              $this.clearTimeout();
              $this.hideBars();
            }

                } 

                $('.touching').off('touchmove').removeClass('touching');
            
          });

                  }
      },

      setTimeout: function(){
        if(plugin.settings.hideBarsDelay > 0){
          var $this = this;
          $this.clearTimeout();
          $this.timeout = window.setTimeout( function(){
            $this.hideBars() },
            plugin.settings.hideBarsDelay
          );
        }
      },
      
      clearTimeout: function(){ 
        window.clearTimeout(this.timeout);
        this.timeout = null;
      },

      showBars : function(){
        var bars = $('#swipebox-caption, #swipebox-action');
        if(this.doCssTrans()){
          bars.addClass('visible-bars');
        }else{
          $('#swipebox-caption').animate({ top : 0 }, 500);
          $('#swipebox-action').animate({ bottom : 0 }, 500);
          setTimeout(function(){
            bars.addClass('visible-bars');
          }, 1000);
        }
      },

      hideBars : function(){
        var bars = $('#swipebox-caption, #swipebox-action');
        if(this.doCssTrans()){
          bars.removeClass('visible-bars');
        }else{
          $('#swipebox-caption').animate({ top : '-50px' }, 500);
          $('#swipebox-action').animate({ bottom : '-50px' }, 500);
          setTimeout(function(){
            bars.removeClass('visible-bars');
          }, 1000);
        }
      },

      animBars : function(){
        var $this = this;
        var bars = $('#swipebox-caption, #swipebox-action');
          
        bars.addClass('visible-bars');
        $this.setTimeout();
        
        $('#swipebox-slider').click(function(e){
          if(!bars.hasClass('visible-bars')){
            $this.showBars();
            $this.setTimeout();
          }
        });

        $('#swipebox-action').hover(function() {
              $this.showBars();
            bars.addClass('force-visible-bars');
            $this.clearTimeout();
          
          },function() { 
            bars.removeClass('force-visible-bars');
            $this.setTimeout();

        });
      },

      keyboard : function(){
        var $this = this;
        $(window).bind('keyup', function(e){
          e.preventDefault();
          e.stopPropagation();
          if (e.keyCode == 37){
            $this.getPrev();
          }
          else if (e.keyCode==39){
            $this.getNext();
          }
          else if (e.keyCode == 27) {
            $this.closeSlide();
            $('body').removeClass('openwide'); 
            $('body').removeClass('open'); 
          }
        });
      },

      actions : function(){
        var $this = this;
        
        if( elements.length < 2 ){
          $('#swipebox-prev, #swipebox-next').hide();
        }else{
          $('#swipebox-prev').bind('click touchend', function(e){
            e.preventDefault();
            e.stopPropagation();
            $this.getPrev();
            $this.setTimeout();
          });
          
          $('#swipebox-next').bind('click touchend', function(e){
            e.preventDefault();
            e.stopPropagation();
            $this.getNext();
            $this.setTimeout();
          });
        }

        $('#swipebox-close').bind('click touchend', function(e){
          $this.closeSlide();
          Backbone.history.navigate('/', { trigger: true });
        });
      },
      
      setSlide : function (index, isFirst){
        var postName = $('.navigation ul > li:nth-child(' + (index + 1) + ') > a').data('post-name');
        Backbone.history.navigate('/post/' + postName, { trigger: true });

        isFirst = isFirst || false;
        
        var slider = $('#swipebox-slider');
        
        if(this.doCssTrans()){
          slider.css({ left : (-index*100)+'%' });
        }else{
          slider.animate({ left : (-index*100)+'%' });
        }
        
        $('#swipebox-slider .slide').removeClass('current');
        $('#swipebox-slider .slide').eq(index).addClass('current');
        this.setTitle(index);

        if( isFirst ){
          slider.fadeIn();
        }

        $('#swipebox-prev, #swipebox-next').removeClass('disabled');
        if(index == 0){
          $('#swipebox-prev').addClass('disabled');
        }else if( index == elements.length - 1 ){
          $('#swipebox-next').addClass('disabled');
        }
      },
    
      openSlide : function (index){
        
        $('html').addClass('swipebox');
        $(window).trigger('resize'); // fix scroll bar visibility on desktop
        this.setSlide(index, true);
      },
    
      preloadMedia : function (index){
        var $this = this, src = null;

        if( elements[index] !== undefined )
          src = elements[index].href;

        if( !$this.isVideo(src) ){
          setTimeout(function(){
            $this.openMedia(index);
          }, 1000);
        }else{

          $this.openMedia(index);
        }
      },
      
      openMedia : function (index){
        var $this = this, src = null;

        if( elements[index] !== undefined )
          src = elements[index].href;

        if(index < 0 || index >= elements.length){
          return false;
        }

        if( !$this.isVideo(src) ){
          $this.loadMedia(src, function(){
            $('#swipebox-slider .slide').eq(index).html(this);
          });
        }else{
          $('#swipebox-slider .slide').eq(index).html($this.getVideo(src));
        }
        
      },

      setTitle : function (index, isFirst){
        var title = null;

        $('#swipebox-caption').empty();

        if( elements[index] !== undefined )
          title = elements[index].title;
        
        if(title){
          $('#swipebox-caption').append(title);
        }
      },

      isVideo : function (src){

        if( src ){
          if( 
            src.match(/youtube\.com\/watch\?v=([a-zA-Z0-9\-_]+)/) 
            || src.match(/vimeo\.com\/([0-9]*)/) 
          ){
            return true;
          }
        }
          
      },

      getVideo : function(url){
        var iframe = '';
        var output = '';
        var youtubeUrl = url.match(/watch\?v=([a-zA-Z0-9\-_]+)/);
        var vimeoUrl = url.match(/vimeo\.com\/([0-9]*)/);
        if( youtubeUrl ){

          iframe = '<iframe width="560" height="315" src="//www.youtube.com/embed/'+youtubeUrl[1]+'" frameborder="0" allowfullscreen></iframe>';
        
        }else if(vimeoUrl){

          iframe = '<iframe width="560" height="315"  src="http://player.vimeo.com/video/'+vimeoUrl[1]+'?byline=0&amp;portrait=0&amp;color='+plugin.settings.vimeoColor+'" frameborder="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>';
        
        }

        return '<div class="swipebox-video-container" style="max-width:'+plugin.settings.videomaxWidth+'px"><div class="swipebox-video">'+iframe+'</div></div>';
      },
      
      loadMedia : function (src, callback){
        
        if( !this.isVideo(src) ){
          var img = $('<img>').on('load', function(){
            callback.call(img);
          });
          
          img.attr('src',src);
        } 
      },
      
      getNext : function (){
        var $this = this;
        index = $('#swipebox-slider .slide').index($('#swipebox-slider .slide.current'));
        if(index+1 < elements.length){
          index++;
          $this.setSlide(index);
          $this.preloadMedia(index+1);
        }
        else{
          
          $('#swipebox-slider').addClass('rightSpring');
          setTimeout(function(){
            $('#swipebox-slider').removeClass('rightSpring');
          },500);
        }
      },
      
      getPrev : function (){
        index = $('#swipebox-slider .slide').index($('#swipebox-slider .slide.current'));
        if(index > 0){
          index--;
          this.setSlide(index);
          this.preloadMedia(index-1);
        }
        else{
          
          $('#swipebox-slider').addClass('leftSpring');
          setTimeout(function(){
            $('#swipebox-slider').removeClass('leftSpring');
          },500);
        }
      },


      closeSlide : function (){
        Backbone.history.navigate('/', { trigger: true });
        $('html').removeClass('swipebox');
        $(window).trigger('resize');
        this.destroy();
      },

      destroy : function(){
        $(window).unbind('keyup');
        $('body').unbind('touchstart');
        $('body').unbind('touchmove');
        $('body').unbind('touchend');
        $('#swipebox-slider').unbind();
        $('#swipebox-overlay').remove();
        if (!$.isArray(elem))
          elem.removeData('_swipebox');
        if ( this.target )
          this.target.trigger('swipebox-destroy');
        $.swipebox.isOpen = false;
        if (plugin.settings.afterClose) 
          plugin.settings.afterClose();
      }

    };

    plugin.init();
    
  };

  $.fn.swipebox = function(options){
    if (!$.data(this, "_swipebox")) {
      var swipebox = new $.swipebox(this, options);
      this.data('_swipebox', swipebox);
    }
    return this.data('_swipebox');
  }

}(window, document, jQuery));


Router = Backbone.Router.extend({
  routes: {
    '': 'home',
    'post/:postName': 'post',
  }
});


router = new Router;

router.on('route', function() {
  console.info(Backbone.history.fragment);

  ga('send', 'pageview', {'page': '/' + Backbone.history.fragment });
})

router.on('route:home', function() {
  if ($.swipebox.isOpen){
    $('#swipebox-close').click();
  }
});

router.on('route:post', function(postName) {
  $('a.nav').click();
  setTimeout(function() {
    $('.navigation a[data-post-name=' + postName + ']').click();
  }, $.swipebox.isOpen ? 0 : 1000);
});




jQuery(function($) {
  $('.box').resizeSlides();
  $('body').append('<div id="left"></div><div id="right"></div><div id="top"></div><div id="bottom"></div>');
  $('.fullscreen-slider .panels').panelSnap({});
  $('.preloader').fadeOut('slow', function() { $(this).remove();$('body').addClass('loaded');});
  Backbone.history.start();

  $(".swipebox").swipebox({
    useCSS : true, // false will force the use of jQuery for animations
    hideBarsDelay : 3000, // 0 to always show caption and action bar
    beforeOpen: function(){
      $("body:not(.openwide)").toggleClass('openwide');  
    }, // called before opening
    afterClose: function(){
      $("body").removeClass('openwide');  
    } // called after closing
  });
});

