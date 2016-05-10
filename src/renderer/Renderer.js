import "../core/";
import "../utils/";
import "../text/";
import "../material/";
import "_RendererScope";
import "_BackBufferRenderer";


function blotter_RendererTextItem (textObject, eventCallbacks) {

  return {
    textObject : textObject,

    eventCallbacks : eventCallbacks || {},

    unsetEventCallbacks : function () {
      _.each(this.eventCallbacks, _.bind(function (callback, eventKey) {
        this.textObject.off(eventKey, callback);
      }, this));
    }
  }
}

Blotter.Renderer = function (material, options) {
  this.init(material, options);
}

Blotter.Renderer.prototype = (function () {

  function _loop () {
    this._backBuffer.render();
    this.imageData = this._backBuffer.imageData;

    _.each(this._scopes, _.bind(function (scope) {
      if (scope.playing) {
        scope.update();
      }
    }, this));

    this.currentAnimationLoop = blotter_Animation.requestAnimationFrame(_.bind(function () {
      _loop.call(this);
    }, this));
  }

  function _updateScopes () {
    _.each(this._texts, _.bind(function (rendererText, textId) {
      (function (self, rendererText) {
        var scope = self._scopes[rendererText.textObject.id];
        if (!scope) {
          scope = self._scopes[rendererText.textObject.id] = new blotter_RendererScope(rendererText.textObject, self);
        }

        scope.needsMaterialUpdate = true;
      })(this, rendererText);
    }, this));
  }

  function _filterTexts (texts) {
    if (texts instanceof Blotter.Text) { //_.isArray(texts)) {
      texts = [texts];
    }
    else {
      texts = _.toArray(texts);
    }

    return _.filter(texts, _.bind(function (text) {
      var isText = text instanceof Blotter.Text;

      if (!isText) {
// ### - messaging
        blotter_Messaging.logError("Blotter.Renderer", "object not instance of Blotter.Text");
      }

      return isText;
    }, this));
  }

  function _setMaterial (material) {
    if (!material || !(material instanceof Blotter.Material)) {
// ### - messaging
      blotter_Messaging.throwError("Blotter.Renderer", "a material must be provided")
    }
    else {
      this.material = material;
      this.material.on("build", _.bind(function () {
        this._backBuffer.update(this.material.width, this.material.height, this.material.threeMaterial);
        _updateScopes.call(this);
        this.trigger("build");
      }, this));

      this.material.on("update", _.bind(function () {
        _update.call(this);
      }, this));
    }
  }

  function _addPrivateTexts (textIds) {
    _.each(textIds, _.bind(function (textId) {
      var text = _.findWhere(this.texts, { id : textId });
      this._texts[text.id] = new blotter_RendererTextItem(text, {
        update : _.bind(function () {
          _update.call(this);
        }, this)
      });
      text.on("update", this._texts[textId].eventCallbacks.update);
    }, this));
  }

  function _removePrivateTexts (textIds) {
    _.each(textIds, _.bind(function (textId) {
      var _text = this._texts[textId],
          _scope = this._scopes[textId];

      _text.unsetEventCallbacks();

      delete _text;
      delete _scope;
    }, this));
  }

  function _setTexts () {
    var currentPrivateTextIds = _.keys(this._texts),
        currentPublicTextIds = _.pluck(this.texts, "id"),
        newTextIds = _.difference(currentPublicTextIds, currentPrivateTextIds),
        removedTextIds = _.difference(currentPrivateTextIds, currentPublicTextIds);

    _addPrivateTexts.call(this, _.difference(currentPublicTextIds, currentPrivateTextIds));
    _removePrivateTexts.call(this, _.difference(currentPrivateTextIds, currentPublicTextIds));
  }

  function _update () {
    _setTexts.call(this);
    this.material.build(_.pluck(this._texts, "textObject"), this.ratio, this.sampleAccuracy);
  }

  return {

    constructor : Blotter.Renderer,

    set needsUpdate (value) {
      if (value === true) {
        _update.call(this);
      }
    },

    init : function (material, options) {
// ### - remove this shit following documentation.
      // There is a negative coorelation between the sampleAccuracy value and
      // the speed at which texture generation happens.
      // However, the lower this value, the less sampleAccuracy you can expect
      // for indexing into uniforms for any given text.
      // Value must be between 0.0 and 1.0, and you are advised to keep it around 0.5.
      _.defaults(this, options, {
        ratio          : blotter_CanvasUtils.pixelRatio,
        autostart      : true,
        autobuild      : true,
        sampleAccuracy : 0.5
      });

      if (!Detector.webgl) {
// ### - messaging
        blotter_Messaging.throwError("Blotter.Renderer", "device does not support webgl");
      }

      this.texts = [];

      this._texts = {};

      this._scopes = {};

      this._backBuffer = new blotter_BackBufferRenderer();

      _setMaterial.call(this, material);

      this.addTexts(options.texts);

      _.extendOwn(this, EventEmitter.prototype);

      if (this.autobuild) {
        this.needsUpdate = true;
      }

      if (this.autostart) {
        this.start();
      }
    },

    start : function () {
      if (!this.currentAnimationLoop) {
        _loop.call(this);
      }
    },

    stop : function () {
      if (this.currentAnimationLoop) {
        blotter_Animation.cancelAnimationFrame(this.currentAnimationLoop);
        this.currentAnimationLoop = undefined;
      }
    },

    teardown : function () {
      this.stop();
      this._backBuffer && this._backBuffer.teardown();
      this.renderer = null;
    },

    addTexts: function(texts) {
      this.texts = _.union(this.texts, _filterTexts.call(this, texts));
    },

    removeTexts: function(texts) {
      this.texts = _.difference(this.texts, _filterTexts.call(this, texts));
    },

    forText : function (text, options) {
      blotter_Messaging.ensureInstanceOf(text, Blotter.Text, "Blotter.Text", "Blotter.Renderer");

      if (!(this._scopes[text.id])) {
// ### - messaging
        blotter_Messaging.logError("Blotter.Renderer", "Blotter.Text object not found in blotter. Set needsUpdate to true.");
        return;
      }
// ### - this is dumb. what if user calls this multiple times (autoplay config..)?
      options = _.defaults(options, {
        autoplay : true
      })

      if (options.autoplay) {
        this._scopes[text.id].playing = true;
      }

      return this._scopes[text.id];
    }
  }
})();
