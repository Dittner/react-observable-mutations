var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import { useLayoutEffect, useRef, useState } from 'react';
import { act } from 'react-dom/test-utils';
/*UID*/
var uidPrefix = Date.now().toString(16) + '-' + Math.floor(Math.random() * (Math.pow(2, 32))).toString(16);
var uidNum = 0;
var uid = function () {
    return uidPrefix + '-' + (uidNum++).toString(16);
};
/*Logging*/
var logInfo = function () {
    var msg = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        msg[_i] = arguments[_i];
    }
    if (ObservableGlobalState.debug)
        console.log.apply(console, msg);
};
var logWarn = function () {
    var msg = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        msg[_i] = arguments[_i];
    }
    console.warn.apply(console, msg);
};
/*Reaction*/
var Reaction = /** @class */ (function () {
    function Reaction(listener) {
        this.uid = uid();
        this.renderCycle = -1;
        this._isDisposed = false;
        this.listener = listener;
    }
    Object.defineProperty(Reaction.prototype, "isDisposed", {
        get: function () { return this._isDisposed; },
        enumerable: false,
        configurable: true
    });
    Reaction.prototype.dispose = function () {
        this._isDisposed = true;
    };
    Reaction.prototype.run = function () {
        this.listener();
    };
    Reaction.empty = new Reaction(function () { });
    return Reaction;
}());
export { Reaction };
var ReactionSet = /** @class */ (function () {
    function ReactionSet() {
        this.reactions = Array();
        this.hash = new Set();
    }
    Object.defineProperty(ReactionSet.prototype, "size", {
        get: function () {
            return this.reactions.length;
        },
        enumerable: false,
        configurable: true
    });
    ReactionSet.prototype.add = function (r) {
        if (!this.hash.has(r.uid)) {
            this.hash.add(r.uid);
            this.reactions.push(r);
        }
    };
    ReactionSet.prototype.clear = function () {
        this.hash.clear();
        this.reactions.length = 0;
    };
    ReactionSet.prototype.remove = function (predicate) {
        var _this = this;
        this.reactions = this.reactions.filter(function (r) {
            if (predicate(r)) {
                _this.hash.delete(r.uid);
                return false;
            }
            else {
                return true;
            }
        });
    };
    ReactionSet.prototype.forEach = function (callbackFn) {
        this.reactions.forEach(callbackFn);
    };
    return ReactionSet;
}());
export { ReactionSet };
var ObservableGlobalState = /** @class */ (function () {
    function ObservableGlobalState() {
    }
    ObservableGlobalState.renderCycle = 0;
    ObservableGlobalState.reaction = Reaction.empty;
    ObservableGlobalState.testMode = false;
    ObservableGlobalState.debug = false;
    return ObservableGlobalState;
}());
export { ObservableGlobalState };
export var ReactionRunnerStatus;
(function (ReactionRunnerStatus) {
    ReactionRunnerStatus["IDLE"] = "IDLE";
    ReactionRunnerStatus["PENDING"] = "PENDING";
    ReactionRunnerStatus["RUNNING"] = "LOADING";
})(ReactionRunnerStatus || (ReactionRunnerStatus = {}));
var ReactionRunner = /** @class */ (function () {
    function ReactionRunner() {
        this.temp = Array();
        this.queue = new Set();
        this.status = ReactionRunnerStatus.IDLE;
        this.INFINITE_LOOP_LIMIT = 20;
        this.infiniteLoopDetected = false;
        this.loopRenderings = 0;
    }
    ReactionRunner.prototype.addToQueue = function (ob) {
        var _this = this;
        if (this.infiniteLoopDetected)
            return;
        if (this.status === ReactionRunnerStatus.RUNNING) {
            this.temp.push(ob);
        }
        else {
            this.queue.add(ob);
            if (this.status === ReactionRunnerStatus.IDLE) {
                this.status = ReactionRunnerStatus.PENDING;
                setTimeout(function () {
                    _this.runAll();
                }, 10);
            }
        }
    };
    ReactionRunner.prototype.runAll = function () {
        var _this = this;
        logInfo('--Start executing of reaction...');
        this.status = ReactionRunnerStatus.RUNNING;
        ObservableGlobalState.renderCycle++;
        var executedReactions = 0;
        this.queue.forEach(function (ob) {
            if (!ob.isDisposed && ob.isMutated) {
                ob.reactions.remove(function (r) { return r.isDisposed; });
                logInfo(ob.className + ':: running of', ob.reactions.size, 'subscribers');
                ob.reactions.forEach(function (r) {
                    if (r.renderCycle !== ObservableGlobalState.renderCycle) {
                        r.renderCycle = ObservableGlobalState.renderCycle;
                        r.run();
                        executedReactions++;
                    }
                });
                ob.ready();
            }
        });
        this.queue.clear();
        this.status = ReactionRunnerStatus.IDLE;
        if (this.temp.length > 0) {
            this.loopRenderings++;
            if (this.loopRenderings > 2) {
                logWarn.apply(void 0, __spreadArray(__spreadArray(['Generating mutations while reactions are running may cause an infinite loop. Loop renderings:', this.loopRenderings,
                    '. Frequently mutated observables: ['], this.temp.map(function (ob) { return ob.className; }), false), [']'], false));
            }
            if (this.loopRenderings < this.INFINITE_LOOP_LIMIT) {
                this.temp.forEach(function (ob) { _this.addToQueue(ob); });
                this.temp.length = 0;
            }
            else {
                this.infiniteLoopDetected = true;
                logWarn('--Infinite Loop! The possible reason: An executed reaction X invoked new rendering of a JSX-component, ' +
                    'that caused mutation in observable object, that added again the reaction X to the execution queue.');
            }
        }
        else {
            this.loopRenderings = 0;
        }
        logInfo("--End of reaction's executing, total executions:", executedReactions);
    };
    ReactionRunner.self = new ReactionRunner();
    return ReactionRunner;
}());
var Observable = /** @class */ (function () {
    function Observable(className) {
        if (className === void 0) { className = ''; }
        this.reactions = new ReactionSet();
        this._isMutated = false;
        this._isDisposed = false;
        this.className = className || 'Some observable';
    }
    Observable.prototype.addReaction = function (reaction) {
        if (this.isDisposed) {
            logWarn('Attempt to subscribe to disposed Observable object!', ', this =', this);
        }
        else {
            this.reactions.add(reaction);
        }
    };
    Observable.prototype.subscribe = function (callback) {
        var _this = this;
        if (this.isDisposed) {
            logWarn('Attempt to subscribe to disposed Observable object!', ', this =', this);
            return function () { };
        }
        else {
            var newReaction_1 = new Reaction(callback);
            this.reactions.add(newReaction_1);
            return function () { _this.reactions.remove(function (r) { return newReaction_1.uid === r.uid; }); };
        }
    };
    Object.defineProperty(Observable.prototype, "isMutated", {
        get: function () { return this._isMutated; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Observable.prototype, "isDisposed", {
        get: function () { return this._isDisposed; },
        enumerable: false,
        configurable: true
    });
    Observable.prototype.mutated = function () {
        if (!this._isMutated) {
            this._isMutated = true;
            logInfo(this.className, 'mutated');
            ReactionRunner.self.addToQueue(this);
        }
    };
    Observable.prototype.ready = function () {
        this._isMutated = false;
    };
    Observable.prototype.dispose = function () {
        if (!this._isDisposed) {
            this._isDisposed = true;
            logInfo('dispose: subscribers before =', this.reactions.size, ', this =', this);
            this.reactions.clear();
            logInfo('dispose: subscribers after =', this.reactions.size + ', this =', this);
        }
    };
    return Observable;
}());
export { Observable };
// GLOBAL OBSERVE METHODS
export function observe(observable) {
    if (observable) {
        if (ObservableGlobalState.reaction !== Reaction.empty) {
            logInfo('observe(' + observable.className + '), reaction uid =', ObservableGlobalState.reaction.uid);
            observable.addReaction(ObservableGlobalState.reaction);
        }
        else {
            logWarn('observe(' + observable.className + ') is failed: JSX Function Component has not "observer" wrapper!');
        }
    }
    return observable;
}
export function observer(component) {
    return function (props) {
        var reactionRef = useRef(Reaction.empty);
        var _a = useState({}), _ = _a[0], forceUpdate = _a[1];
        if (reactionRef.current === Reaction.empty) {
            reactionRef.current = new Reaction(function () {
                if (ObservableGlobalState.testMode) {
                    act(function () {
                        forceUpdate({});
                    });
                }
                else {
                    forceUpdate({});
                }
            });
        }
        useLayoutEffect(function () { return function () { reactionRef.current.dispose(); }; }, []);
        var parentGlobalReaction = ObservableGlobalState.reaction;
        ObservableGlobalState.reaction = reactionRef.current;
        reactionRef.current.renderCycle = ObservableGlobalState.renderCycle;
        var renderedComponent = component(props);
        ObservableGlobalState.reaction = parentGlobalReaction;
        return renderedComponent;
    };
}
