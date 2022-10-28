var utils = require('utils');

const normal_creep = [MOVE]; 

const build_creeps = [0, normal_creep, utils.get_creep_cost(normal_creep)];

var roleBuilder = {

    run: function(creep) {
        if (creep.spawning)
            return;
        utils.move_to(creep, null, true);
	},
	
	create_creep: function(spawn) {
        
    },
    
    upgrade: function(room) {
        
    },

    cleanUp(id) {
        
    }
};

module.exports = roleBuilder;