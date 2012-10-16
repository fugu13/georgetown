/*
   Copyright 2012 Saltbox Services LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var georgetown = function() {
    if (!Array.prototype.map)
    {
      Array.prototype.map = function(fun /*, thisp*/)
      {
        var len = this.length;
        if (typeof fun != "function")
          throw new TypeError();

        var res = new Array(len);
        var thisp = arguments[1];
        for (var i = 0; i < len; i++)
        {
          if (i in this)
            res[i] = fun.call(thisp, this[i], i, this);
        }

        return res;
      };
    }

    function GUID () {
        var S4 = function () {
            four = Math.floor(
                    Math.random() * 0x10000 /* 65536 */
                ).toString(16);
            return ("0000" + four).slice(-4);
        };

        return (
                S4() + S4() + "-" +
                S4() + "-" +
                S4() + "-" +
                S4() + "-" +
                S4() + S4() + S4()
            );
    }


    var extract = function(value) {
        if(value) {
            if(value.shift) {
                return value.shift();
            } else {
                return value;
            }
        }
    };

    var update = function(target, source) {
        var key;
        for(key in source) {
            target[key] = source[key];
        }
        return target;
    };

    var Details = function(text, keys) {
        this.text = text || '';
        this.keys = keys || {};
    };

    Details.prototype.unpack = function(text, keys) {
        if(text.text) {
            return text;
        } else {
            return new Details(text, keys);
        }
    };

    Details.prototype.append = function(text, keys) {
        var details = this.unpack(text, keys);
        this.text += details.text;
        update(this.keys, details.keys);
        return this;
    };

    Details.prototype.simplify = function(text) {
        return text.replace(/{\/?\w{8}-\w{4}-\w{4}-\w{4}-\w{12}}/g, '');
    };

    Details.prototype.toString = function() {
        return this.simplify(this.text);
    };

    Details.prototype.linkify = function(linkers) {
        var text = this.text;
        for(code in this.keys) {
            var type = this.keys[code].type;
            var identifier = this.keys[code].identifier;
            if(!identifier.substr) {
                identifier = JSON.stringify(identifier);
            }
            identifier = encodeURIComponent(identifier);
            var linker = linkers[type];
            if(linker) {
                var opener = linker.opener.replace("{identifier}", identifier);
                var closer = linker.closer.replace("{identifier}", identifier);
                text = text.replace("{" + code + "}", opener);
                text = text.replace("{/" + code + "}", closer);
            }
        }
        return this.simplify(text);
    };

    Details.prototype.wrap = function(text, type, identifier) {
        var key = GUID();
        var keys = {}
        keys[key] = {
            type: type,
            identifier: identifier
        };
        return this.append("{" + key + "}" + text + "{/" + key + "}", keys);
    };

    Details.prototype.removeTrailing = function(trailing) {
        this.text = this.text.substr(0, this.text.length - trailing.length);
        return this;
    };

    var Translated = function(text, keys) {
        Details.call(this, text, keys);
        this.addendums = [];
    };
    Translated.prototype = new Details();
    Translated.prototype.constructor = Translated;

    Translated.prototype.addendum = function(text, keys) {
        var details = this.unpack(text, keys);
        this.addendums.push(details);
        return details;
    };

    var agent_id = function(agent) {
        var copy = update({}, agent);
        delete copy.name;
        delete copy.member;
        return copy;
    };

    var agent_id_link = function(agent) {
        var mbox = extract(agent.mbox);
        var openid = extract(agent.openid);
        var hash = extract(agent.mbox_sha1sum);
        var account = extract(agent.account);
        if (mbox) {
            return mbox.substr(7);
        }
        if(openid) {
            return "OpenID " + openid;
        }
        if(hash) {
            return "email hash " + hash;
        }
        if(account) {
            return account.name + " on " + account.homePage;
        }
    };

    var translate_agent = function(agent) {
        var details = new Details();
        var name = extract(agent.name);
        var identifier = agent_id(agent);
        var id_link = agent_id_link(agent);
        if(name) {
            details.append(name);
        }
        if (id_link) {
            if(name) {
                details.append(" (");
            }
            details.wrap(id_link, "Agent", identifier);
            if(name) {
                details.append(")");
            }
        }

        if(agent.objectType == 'Group') {
            if(name || id_link) {
                details.append(", a Group");
            } else {
                details.append("a Group");
            }
            if(agent.member) {
                details.append(" with members [");
                var joiner = function(agent_part) {
                    details.append(agent_part);
                    details.append(", ");

                };
                agent.member.map(translate_agent).map(joiner);
                details.removeTrailing(", ");
                details.append("]");
            }
        }
        return details;
    };


    var language = function(mapping) {
        if (mapping) {
            var key;
            var english = mapping['en'] || mapping['en-US'] || mapping['en-GB']; // we could go on, and should sometime
            if(english) { //prefer english for now
                return english;
            }
            for(key in mapping) {
                if (mapping.hasOwnProperty(key)) {
                    return mapping[key]; //return the first value we find
                }
            }
        }
        return undefined;
    };

    var translate_activity = function(activity) {
        var details = new Details();
        if(activity.definition) {
            var name = language(activity.definition.name) || "An activity"; //TODO: language smarts, arguments
            var description = language(activity.definition.description);
            var type = activity.definition.type;
            var interaction = activity.definition.interactionType;
            details.wrap(name, "Activity", activity.id);
            if (description) {
                details.append(", described as '" + description + "'");
            }
            types = [];
            if(type) {
                types.push("type " + type); //TODO: activity type pages?
            }
            if(interaction) {
                types.push("a " + interaction + " interaction");
            }
            if(types.length) {
                details.append(" (" + types.join(", ") + ")");
            }
            //TODO: alert user to the presence of interactionType etc
        } else {
            details.wrap(activity.id, "Activity", activity.id);
        }
        return details;
    };
    
    var translate_verb = function(verb) {
        var details = new Details();
        var name = language(verb.display);
        if(name) {
            return details.wrap(name, "Verb", verb.id);
        }
        return details.append(
            "acted with the meaning of "
        ).wrap(
            verb.id, "Verb", verb.id
        ).append(" on ");
    };

    var translate_result = function(result) {
        if(result) {
            var base = '';
            if(result.score) {
                base = base + 'scoring ';
                var percent = result.score.scaled && Math.round(result.score.scaled * 100);
                var raw = result.score.raw || '';
                var out_of = result.score['max'] || '';
                var combined = raw && (raw + (out_of && ("/" + out_of)));
                if(percent) {
                    base = base + percent + "% ";
                    if (combined) {
                        base = base + "(" + combined + ") ";
                    }
                } else if(combined) {
                    base = base + combined + " ";
                }
            }
            if(base) {
                base = base + "and ";
            }
            if(result.success) {
                base = base + "succeeding";
            } else if(result.success === false) {
                base = base + "failing";
            } else if(result.completion) {
                base = base + "completing";
            } else if(result.completion === false) {
                base = base + "not completing";
            }
            if(result.response) {
                if(base) {
                    base = base + " with response ";
                } else {
                    base = "responding with ";
                }
                base = base + "'" + result.response + "'";
            }
            if(result.duration) {
                if(base) {
                    base = base + ", ";
                }
                base = base + "over a duration of " + result.duration;
            }
            return base;
        } else {
            alert("empty result object!");
        }
    };

    var translate = function(statement) {
        var base = new Translated();
        base.append(
            translate_agent(statement.actor)
        ).append(
            " "
        ).append(
            translate_verb(statement.verb)
        ).append(
            " "
        );
        switch(statement.object.objectType) {
            case undefined:
            case 'Activity':
                base.append(
                    translate_activity(statement.object)
                );
                break;
            case 'StatementRef': //TODO: StatementRef, SubStatement
                base.append("the statement ").wrap(
                    statement.object.id,
                    "StatementRef",
                    statement.object.id
                );
                break;
            case 'SubStatement': //TODO: StatementRef, SubStatement
                base.append("a future statement (see raw).");
                break;
            case 'Group': //TODO: make work right
            case 'Agent':
                base.append(
                    translate_agent(statement.object)
                );
                break;
            default:
                alert('Error: illegal object type ' + statement.object.objectType);
        }
        //TODO: currently in progress, result, lots of context stuff, at time, says authority.
        //result "scoring x%, y out of z, succeeding/failing/completing
        //context: in registration, instructed by, as part of team, in the activity (parent), grouped with the activity (grouping), related to the activity (other)
        //  using the language, as an addendum to statement
        if(statement.result) {
            base.addendum(translate_result(statement.result));
        }
        if(statement.context) {
            if(statement.context.registration) {
                base.addendum("with registration ").wrap(
                    statement.context.registration,
                    "Registration",
                    statement.context.registration
                );
            }
            
            if(statement.context.contextActivities) {
                var activities = statement.context.contextActivities;
                if(activities.parent) {
                    base.addendum("as part of ").append(translate_activity(activities.parent));
                }
                if(activities.grouping) {
                    base.addendum("grouped with ").append(translate_activity(activities.grouping));
                }
                if(activities.other) {
                    base.addendum("related to ").append(translate_activity(activities.other));
                }
            }
            if(statement.context.instructor) {
                base.addendum("instructed by ").append(translate_agent(statement.context.instructor));
            }
            if(statement.context.team) {
                base.addendum("on team ").append(translate_agent(statement.context.team));
            }
            if(statement.context.language) {
                base.addendum("using the language " + statement.context.language);
            }
            if(statement.context.statement) {
                base.addendum("as an addendum to the statement ").wrap(
                    statement.context.statement.id,
                    "StatementRef",
                    statement.context.statement.id
                );
            }
        }
        if(statement.timestamp) {
            base.addendum("taking place at " + statement.timestamp);
        }
        if (statement.stored) {
            base.addendum("stored in this LRS at " + statement.stored);
        };
        if(statement.voided) {
            base.addendum("but this statement has been voided");
        }
        if(statement.id) {
           base.addendum("(This statement's id is " + statement.id + ")");
        }
        /* if(statement.authority) {
            base.addendum("according to ").append(translate_agent(statement.authority));
        } */
        return base;
    };

    return {
        translate: translate,
    };
}();
