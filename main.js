/*!
  Autosize v1.17.8 - 2013-09-07
  Automatically adjust textarea height based on user input.
  (c) 2013 Jack Moore - http://www.jacklmoore.com/autosize
  license: http://www.opensource.org/licenses/mit-license.php
*/
(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else {
    // Browser globals: jQuery or jQuery-like library, such as Zepto
    factory(window.jQuery || window.$);
  }
}(function ($) {
  var
  defaults = {
    className: 'autosizejs',
    append: '',
    callback: false,
    resizeDelay: 10
  },

  // border:0 is unnecessary, but avoids a bug in FireFox on OSX
  copy = '<textarea tabindex="-1" style="position:absolute; top:-999px; left:0; right:auto; bottom:auto; border:0; padding: 0; -moz-box-sizing:content-box; -webkit-box-sizing:content-box; box-sizing:content-box; word-wrap:break-word; height:0 !important; min-height:0 !important; overflow:hidden; transition:none; -webkit-transition:none; -moz-transition:none;"/>',

  // line-height is conditionally included because IE7/IE8/old Opera do not return the correct value.
  typographyStyles = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'textTransform',
    'wordSpacing',
    'textIndent'
  ],

  // to keep track which textarea is being mirrored when adjust() is called.
  mirrored,

  // the mirror element, which is used to calculate what size the mirrored element should be.
  mirror = $(copy).data('autosize', true)[0];

  // test that line-height can be accurately copied.
  mirror.style.lineHeight = '99px';
  if ($(mirror).css('lineHeight') === '99px') {
    typographyStyles.push('lineHeight');
  }
  mirror.style.lineHeight = '';

  $.fn.autosize = function (options) {
    if (!this.length) {
      return this;
    }

    options = $.extend({}, defaults, options || {});

    if (mirror.parentNode !== document.body) {
      $(document.body).append(mirror);
    }

    return this.each(function () {
      var
      ta = this,
      $ta = $(ta),
      maxHeight,
      minHeight,
      boxOffset = 0,
      callback = $.isFunction(options.callback),
      originalStyles = {
        height: ta.style.height,
        overflow: ta.style.overflow,
        overflowY: ta.style.overflowY,
        wordWrap: ta.style.wordWrap,
        resize: ta.style.resize
      },
      timeout,
      width = $ta.width();

      if ($ta.data('autosize')) {
        // exit if autosize has already been applied, or if the textarea is the mirror element.
        return;
      }
      $ta.data('autosize', true);

      if ($ta.css('box-sizing') === 'border-box' || $ta.css('-moz-box-sizing') === 'border-box' || $ta.css('-webkit-box-sizing') === 'border-box'){
        boxOffset = $ta.outerHeight() - $ta.height();
      }

      // IE8 and lower return 'auto', which parses to NaN, if no min-height is set.
      minHeight = Math.max(parseInt($ta.css('minHeight'), 10) - boxOffset || 0, $ta.height());

      $ta.css({
        overflow: 'hidden',
        overflowY: 'hidden',
        wordWrap: 'break-word', // horizontal overflow is hidden, so break-word is necessary for handling words longer than the textarea width
        resize: ($ta.css('resize') === 'none' || $ta.css('resize') === 'vertical') ? 'none' : 'horizontal'
      });

      // The mirror width must exactly match the textarea width, so using getBoundingClientRect because it doesn't round the sub-pixel value.
      function setWidth() {
        var style, width;

        if ('getComputedStyle' in window) {
          style = window.getComputedStyle(ta);
          width = ta.getBoundingClientRect().width;

          $.each(['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'], function(i,val){
            width -= parseInt(style[val],10);
          });

          mirror.style.width = width + 'px';
        }
        else {
          // window.getComputedStyle, getBoundingClientRect returning a width are unsupported and unneeded in IE8 and lower.
          mirror.style.width = Math.max($ta.width(), 0) + 'px';
        }
      }

      function initMirror() {
        var styles = {};

        mirrored = ta;
        mirror.className = options.className;
        maxHeight = parseInt($ta.css('maxHeight'), 10);

        // mirror is a duplicate textarea located off-screen that
        // is automatically updated to contain the same text as the
        // original textarea.  mirror always has a height of 0.
        // This gives a cross-browser supported way getting the actual
        // height of the text, through the scrollTop property.
        $.each(typographyStyles, function(i,val){
          styles[val] = $ta.css(val);
        });
        $(mirror).css(styles);

        setWidth();

        // Chrome-specific fix:
        // When the textarea y-overflow is hidden, Chrome doesn't reflow the text to account for the space
        // made available by removing the scrollbar. This workaround triggers the reflow for Chrome.
        if (window.chrome) {
          var width = ta.style.width;
          ta.style.width = '0px';
          var ignore = ta.offsetWidth;
          ta.style.width = width;
        }
      }

      // Using mainly bare JS in this function because it is going
      // to fire very often while typing, and needs to very efficient.
      function adjust() {
        var height, original;

        if (mirrored !== ta) {
          initMirror();
        } else {
          setWidth();
        }

        mirror.value = ta.value + options.append;
        mirror.style.overflowY = ta.style.overflowY;
        original = parseInt(ta.style.height,10);

        // Setting scrollTop to zero is needed in IE8 and lower for the next step to be accurately applied
        mirror.scrollTop = 0;

        mirror.scrollTop = 9e4;

        // Using scrollTop rather than scrollHeight because scrollHeight is non-standard and includes padding.
        height = mirror.scrollTop;

        if (maxHeight && height > maxHeight) {
          ta.style.overflowY = 'scroll';
          height = maxHeight;
        } else {
          ta.style.overflowY = 'hidden';
          if (height < minHeight) {
            height = minHeight;
          }
        }

        height += boxOffset;

        if (original !== height) {
          ta.style.height = height + 'px';
          if (callback) {
            options.callback.call(ta,ta);
          }
        }
      }

      function resize () {
        clearTimeout(timeout);
        timeout = setTimeout(function(){
          var newWidth = $ta.width();

          if (newWidth !== width) {
            width = newWidth;
            adjust();
          }
        }, parseInt(options.resizeDelay,10));
      }

      if ('onpropertychange' in ta) {
        if ('oninput' in ta) {
          // Detects IE9.  IE9 does not fire onpropertychange or oninput for deletions,
          // so binding to onkeyup to catch most of those occasions.  There is no way that I
          // know of to detect something like 'cut' in IE9.
          $ta.on('input.autosize keyup.autosize', adjust);
        } else {
          // IE7 / IE8
          $ta.on('propertychange.autosize', function(){
            if(event.propertyName === 'value'){
              adjust();
            }
          });
        }
      } else {
        // Modern Browsers
        $ta.on('input.autosize', adjust);
      }

      // Set options.resizeDelay to false if using fixed-width textarea elements.
      // Uses a timeout and width check to reduce the amount of times adjust needs to be called after window resize.

      if (options.resizeDelay !== false) {
        $(window).on('resize.autosize', resize);
      }

      // Event for manual triggering if needed.
      // Should only be needed when the value of the textarea is changed through JavaScript rather than user input.
      $ta.on('autosize.resize', adjust);

      // Event for manual triggering that also forces the styles to update as well.
      // Should only be needed if one of typography styles of the textarea change, and the textarea is already the target of the adjust method.
      $ta.on('autosize.resizeIncludeStyle', function() {
        mirrored = null;
        adjust();
      });

      $ta.on('autosize.destroy', function(){
        mirrored = null;
        clearTimeout(timeout);
        $(window).off('resize', resize);
        $ta
          .off('autosize')
          .off('.autosize')
          .css(originalStyles)
          .removeData('autosize');
      });

      // Call adjust in case the textarea already contains text.
      adjust();
    });
  };
}));

(function ($, window, document) {
  "use strict";
  // This code is only for iOS
  if (!window.navigator.userAgent.match(/(iPhone|iPad|iPod)/)) {
    return;
  }

  var CONFIG = {
    TOUCH_MOVE_THRESHHOLD: 10,
    PRESSED_CLASS: "pressed",
    GHOST_CLICK_TIMEOUT: 500,
    GHOST_CLICK_THRESHOLD: 10
  }, clicks = [];

  function withinDistance(x1, y1, x2, y2, distance) {
    return Math.abs(x1 - x2) < distance && Math.abs(y1 - y2) < distance;
  }

  // Use a native event listener so we can set useCapture
  document.addEventListener('click', function (e) {
    for (var i = 0; i < clicks.length; i++) {
      // For some reason, the ghost click events don't always appear where the touchend event was
      if (withinDistance(clicks[i][0], clicks[i][1], e.clientX, e.clientY,
        CONFIG.GHOST_CLICK_THRESHOLD)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }, true);

  $(document).on('touchstart', '.button', function (e) {
    var elem = $(this);

    // Disable the webkit tap highlight, since it is no longer accurate
    elem.css('webkitTapHighlightColor', 'rgba(0,0,0,0)');

    elem.addClass(CONFIG.PRESSED_CLASS);

    var touch = e.originalEvent.touches[0];
    var location = [touch.clientX, touch.clientY];
    this.__eventLocation = location;

    this.__onTouchMove = function (e) {
      var touch = e.originalEvent.touches[0];
      if (withinDistance(touch.clientX, touch.clientY, location[0], location[1],
        CONFIG.TOUCH_MOVE_THRESHHOLD)) {
        elem.addClass(CONFIG.PRESSED_CLASS);
      } else {
        elem.removeClass(CONFIG.PRESSED_CLASS);
      }
    };

    $(document.body).on('touchmove', this.__onTouchMove);
  });

  $(document).on('touchcancel', '.button', function () {
    var elem = $(this);
    elem.removeClass(CONFIG.PRESSED_CLASS);
    $(document.body).off('touchmove', this.__onTouchMove);
  });

  $(document).on('touchend', '.button', function (e) {
    var elem = $(this);
    if (elem.hasClass(CONFIG.PRESSED_CLASS)) {
      elem.removeClass(CONFIG.PRESSED_CLASS);
      var location = this.__eventLocation;
      if (location) {
        var touch = e.originalEvent.changedTouches[0];
        if (!withinDistance(touch.clientX, touch.clientY, location[0], location[1],
          CONFIG.TOUCH_MOVE_THRESHHOLD)) {
          return;
        }

        // Dispatch a fake click event within a setTimeout. If we don't do this, there's a strange bug where
        // the next view can't correctly bring the keyboard up
        setTimeout(function() {
          var evt = document.createEvent("MouseEvents");
          evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
          elem.get(0).dispatchEvent(evt);
        }, 1);

        // Don't process the default action for this event to avoid WebKit stealing focus from a
        // view we might be loading, and from dispatching a click event
        e.preventDefault();

        // Eat further "ghost" click events at this location that appear if the user holds the link down
        // longer than the double-tap cancel threshold (these are not cancelled when preventing default)
        var clickLocation = [touch.clientX, touch.clientY];
        clicks.push(clickLocation);
        window.setTimeout(function() {
          var i = clicks.indexOf(clickLocation);
          if (i >= 0) {
            clicks.splice(i, 1);
          }
        }, CONFIG.GHOST_CLICK_TIMEOUT);
      }
    }

    $(document.body).off('touchmove', this.__onTouchMove);
  });

})(jQuery, window, document);

document.addEventListener("touchstart", function(){}, true);

/* Auto-resizing textarea */

$(document).ready(function(){
    $('.black-wrap').addClass('load');
    $('textarea').autosize();
});

/*var images = ['homebg2.jpg', 'homebg3.jpg', 'homebg4.jpg', 'homebg6.jpg'];
var logo = ['#00999A', '#92C516', '#C02C19'];

Math.floor(Math.random()*6);

$('.wrapper').css({'background-image': 'url(img/' + images[Math.floor(Math.random() * images.length)] + ')'});

$('header.top .logo a').css({'color': logo[Math.floor(Math.random() * logo.length)] });*/


// When ready...
window.addEventListener("load",function() {
    // Set a timeout...
    setTimeout(function(){
        // Hide the address bar!
        window.scrollTo(0, 1);
    }, 0);
});

$(function() {
    if ($('section').hasClass('first')) {
        $('header.top').addClass('head-page')
        $('body').addClass('home')
    }
});

$(function() {
    if ($('section').hasClass('error')) {
        $('footer').css('marginTop','0')
        $('.black-cover').css('backgroundImage','url(http://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/NASA-Apollo8-Dec24-Earthrise.jpg/1024px-NASA-Apollo8-Dec24-Earthrise.jpg)');
        $('.black-cover').css('backgroundRepeat','no-repeat');
    }
});

var images = ['one.jpg', 'two.jpg', 'four.jpg', 'five.jpg', 'six.jpg', 'eight.jpg', 'nine.jpg', 'ten.jpg', 'twelve.jpg', 'thirteen.jpg', 'fourteen.jpg',];

$(document).ready(function(){
  bgid = images[Math.floor(Math.random() * images.length)];
});

// On scroll background fade
$(document).scroll(function(){
var opac = $(document).scrollTop() / ($('.black-cover').height() - 300);
$('.black-cover').css({'background': 'linear-gradient(rgba(0,0,0,' + opac + '),rgba(0,0,0,' + opac + ')), url(img/bg/' + bgid + ')','background-repeat':'no-repeat','background-size':'cover'});
});

// Background load

 /*

var images = ['one.jpg', 'two.jpg', 'three.jpg', 'four.jpg', 'five.jpg', 'six.jpg', 'seven.jpg', 'eight.jpg', 'nine.jpg', 'ten.jpg', 'eleven.jpg', 'twelve.jpg', 'thirteen.jpg', 'fourteen.jpg', 'sixteen.jpg'];
$('.black-cover').css({'background-image': 'url(img/bg/' + images[Math.floor(Math.random() * images.length)] + ')'});*/

// Updates goodness

var pages = ['/projects', 'https://twitter.com/gyanprayaga'];

$(function() {
    $(document).keyup(function(e) {
        if ($(e.target).is('input, textarea')) {
            return;
        }
        if (e.which === 74) { location.href= pages[Math.floor(Math.random() * pages.length)]; };
        if (e.which === 72) { location.href='http://jujubeweb.com' };

    });
});

$(".random, #random").click(function() {
   location.href= pages[Math.floor(Math.random() * pages.length)] ;
});

// Show pressdown
$(document).keydown(function(e) {
  if (e.keyCode == 74) {
      $('.updates').toggleClass("red");
    }
});

// Fadein and out for nav-slide
$( ".toggle" ).click(function() {
  $( ".nav-slide" ).fadeIn( "fast" );
});

$( "#close" ).click(function() {
  $( ".nav-slide" ).fadeOut( "fast" );
});

// Show tip
$( ".trigger" ).click(function() {
    $(this).html("Press <span>J</span> to jump to a random project, or <strong>H</strong> to go home.");
});

$( ".err" ).click(function() {
    $(this).html("You must have mistyped a URL. Or visited a page that doesn&#39;t exist. This sort of wayward behavior is called a 404.");
});

// Trigger escape on popup
$(document).keydown(function(e) {
  if (e.keyCode == 27) {
  $( ".nav-slide" ).fadeOut( "fast" );
    }
});

// Nav active indicator
$(function() {
    if ($('h1').hasClass('about-ident')) {
        $('#navigation a#about').addClass('active')
    }
});

$(function() {
    if ($('h1').hasClass('work-ident')) {
        $('#navigation a#work').addClass('active')
    }
});

$(function() {
    if ($('h1').hasClass('contact-ident')) {
        $('#navigation a#contact').addClass('active')
    }
});

$(document).ready(function()
        {
            $('input[required], input[required="required"]').each(function(i, e)
            {
                e.oninput = function(el)
                {
                    el.target.setCustomValidity("");

                    if (el.target.type == "email")
                    {
                        if (el.target.validity.patternMismatch)
                        {
                            el.target.setCustomValidity("You're almost there!");

                            if (el.target.validity.typeMismatch)
                            {
                                el.target.setCustomValidity("That's it? There must be more!");
                            }
                        }
                    }
                };

                e.oninvalid = function(el)
                {
                    el.target.setCustomValidity(!el.target.validity.valid ? e.attributes.requiredmessage.value : "");
                };
            });

            // Some extra validation at the form submit
            $("form").on("submit", function(e)
            {
                for (var i = 0; i < e.target.length; i++)
                {
                    if (!e.target[i].validity.valid)
                    {
                        window.alert(e.target.attributes.requiredmessage.value);
                        e.target.focus();
                        return false;
                    }
                }
            });
        });
