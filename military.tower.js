var utils = require('utils');
 
var militaryTower = {
   run: function(room) {
      const towers = room.find(FIND_MY_STRUCTURES, {
         filter: { structureType: STRUCTURE_TOWER }
      });
      const enemies = room.find(FIND_HOSTILE_CREEPS);
      if (!enemies || enemies.length == 0) {
         return;
      }
      for (const tK in towers) {
         const tower = towers[tK];
         const enemy = tower.pos.findClosestByRange(enemies);
         tower.attack(enemy);
      }
   }
    
}

module.exports = militaryTower;