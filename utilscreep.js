let filtered_mapping = {};
let filtered_role_home_mapping = {};

let mapping_room_to_spawn = {};

var utilscreep = {

    generateRoomToSpawnMapping: function() {
        mapping_room_to_spawn = {};
        for (const k in Game.spawns) {
            const spawn = Game.spawns[k];
            if (!(spawn.room.name in mapping_room_to_spawn)) {
                mapping_room_to_spawn[spawn.room.name] = [];
            }
            mapping_room_to_spawn[spawn.room.name].push(spawn);
        }
    },

    getRoomToSpawnMapping: function() {
        return mapping_room_to_spawn;
    },

    get_filtered_creeps: function(role) {
        if (!(role in filtered_mapping)) {
            // doesnt exist lets add it
            filtered_mapping[role] = _.filter(Game.creeps, (creep) => creep.memory.role == role);
        }
        return filtered_mapping[role];
    },

    get_role_home_filtered_creeps: function(home, role) {
        const hKey = [role, home];
        const v = filtered_role_home_mapping[hKey];
        if (!v) {
            return [];
        }
        return v;
    },

    add_creep: function(creep) {
        const r = creep.memory.role;
        const hKey = [r, creep.memory.home_room];
        if (!(r in filtered_mapping)) {
            filtered_mapping[r] = [];
        }
        filtered_mapping[r].push(creep);
        if (!filtered_role_home_mapping[hKey]) {
            filtered_role_home_mapping[hKey] = [];
        }
        filtered_role_home_mapping[hKey].push(creep);
    },
    
    clear_filtered_creeps: function() {
        filtered_mapping = {};
        filtered_role_home_mapping = {};
        for (const k in Game.creeps) {
            const v = Game.creeps[k];
            const r = v.memory.role;
            if (!(r in filtered_mapping)) {
                filtered_mapping[r] = [];
            }

            const hKey = [r, v.memory.home_room];
            if (!(hKey in filtered_role_home_mapping)) {
                filtered_role_home_mapping[hKey] = [];
            }
            filtered_mapping[r].push(v);
            filtered_role_home_mapping[hKey].push(v);
        }
    }
};

module.exports = utilscreep;