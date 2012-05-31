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


var extract = function(value) {
    if(value) {
        if(value.shift) {
            return value.shift();
        } else {
            return value;
        }
    }
};


var translate_agent = function(agent) {
    if (agent) {
        var name = extract(agent.name);
        var first_name = extract(agent.givenName) || extract(agent.firstName);
        var last_name = extract(agent.familyName) || extract(agent.lastName);
        var mbox = extract(agent.mbox);
        if (name) {
            return name;
        }
        if (first_name || last_name) {
            if (first_name && last_name) {
                return first_name + " " + last_name;
            }
            return first_name || last_name;
        }
        if (mbox) {
            return mbox.substr(5);
        }
        return "a " + (agent.objectType || "Person");
    } else {
        return "I";
    }
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
    if(activity.definition) {
        var name = language(activity.definition.name);
        var description = language(activity.definition.description);
        var type = activity.definition.type;
        var interaction = activity.definition.interactionType;
        var base = '';
        if(type) {
            base = base + 'the ' + type + " ";
        }
        if(interaction) {
            base = base + "(a " + interaction + " interaction) ";
            if(!type) {
                alert("No interactionType allowed without a type! (and really the type should be interaction or question)");
            }
        }
        if(name) {
            base = base + name + " ";
        } else if (description) {
            base = base + "described as '" + description + "' ";
        }
        return base + activity.id;
    } else {
        return activity.id;
    }
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
        return base;
    } else {
        alert("empty result object!");
    }
};

var translate = function(statement) {
    var base = translate_agent(statement.actor) + " " + statement.verb;
    switch(statement.object.objectType) {
        case undefined:
        case 'Activity':
            base = base + " " + translate_activity(statement.object);
            break;
        case 'Statement':
            base = base + " the statement " + statement.object.id;
            break;
        case 'Person':
        case 'Agent':
            base = base + " " + translate_agent(statement.object);
            break;
        default:
            alert('Error: illegal object type ' + statement.object.objectType);
    }
    var addendums = [];
    //TODO: currently in progress, result, lots of context stuff, at time, says authority.
    //result "scoring x%, y out of z, succeeding/failing/completing
    //context: in registration, instructed by, as part of team, in the activity (parent), grouped with the activity (grouping), related to the activity (other)
    //  using the language, as an addendum to statement
    if(statement.inProgress) {
        addendums.push("currently in progress");
    }
    if(statement.result) {
        addendums.push(translate_result(statement.result));
    }
    if(statement.context) {
        if(statement.context.registration) {
            addendums.push("with registration " + statement.context.registration);
        }
        if(statement.context.instructor) {
            addendums.push("instructed by " + translate_agent(statement.context.instructor));
        }
        if(statement.context.team) {
            //this will tend to look really awkward. Consider options?
            addendums.push("on team " + translate_agent(statement.context.team));
        }
        if(statement.context.contextActivities) {
            var activities = statement.context.contextActivities;
            if(activities.parent) {
                addendums.push("in the activity " + translate_activity(activities.parent));
            }
            if(activities.grouping) {
                addendums.push("grouped with the activity " + translate_activity(activities.grouping));
            }
            if(activities.other) {
                addendums.push("related to the activity " + translate_activity(activities.other));
            }
        }
        if(statement.context.language) {
            addendums.push("using the language " + statement.context.language);
        }
        if(statement.context.statement) {
            addendums.push("as an addendum to the statement " + statement.context.statement.id);
        }
    }
    if(statement.authority) {
        var addendum = "according to ";
        if(statement.authority.member) {
            if(statement.authority.member.length == 2) {
                addendum = addendum + translate_agent(statement.authority.member[0]) + " and ";
                addendum = addendum + translate_agent(statement.authority.member[1]);
            } else {
                alert("Group authorities must always have 2 members!");
            }
        } else {
            addendum = addendum + translate_agent(statement.authority);
        }
        addendums.push(addendum);
    }
    return {
        base: base,
        addendums: addendums
    }
};
