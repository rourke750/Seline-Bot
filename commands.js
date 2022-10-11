const commands = {
    clearSpawn: function() {
        for (const k in Memory.rooms) {
            if (Game.rooms[k] && Game.rooms[k].controller && Game.rooms[k].controller.my)
                continue;
            Memory.rooms[k].spawnMasterX = undefined;
            Memory.rooms[k].spawnMasterY = undefined;
        }
    },

    findFutureRooms: function() {
        const r = [];
        for (const k in Memory.rooms) {
            if (Game.rooms[k] && Game.rooms[k].controller && Game.rooms[k].controller.my)
                continue;
            if (Memory.rooms[k].spawnMasterX && Memory.rooms[k].spawnMasterY) {
                r.push(k);
            }
        }
        console.log(JSON.stringify(r))
    },

    // global.commands.createFakeCreep('W7N4-1', 'W7N4', 29, 8)
    createFakeCreep: function(s, room, dstX, dstY) {
        const spawn = Game.spawns[s];
        var newName = 'Fake' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep([MOVE], newName,
            {memory: {role: 'fake', destLoc: {x: dstX, y: dstY, roomName: room}}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    }
}

module.exports = commands;