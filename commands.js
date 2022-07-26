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
    }
}

module.exports = commands;