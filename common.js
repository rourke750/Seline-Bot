const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');
const roleHauler = require('roles.hauler');

const militaryScout = require('roles.scout');
const militaryDefender = require('military.defender');
const militaryTower = require('military.tower');


const ROOM_TYPE = {
    UNOWNED: 0,
    RESERVED: 1,
    MY_RESERVATION: 2,
    OWNED: 3
}

const common = {
    roomMapping: ROOM_TYPE,
    maxConstructionsPerRoom: 5,
    username: 'rourke750',

    creepMapping: {
        'harvester' : roleHarvester,
        'upgrader' : roleUpgrader,
        'builder' : roleBuilder,
        'repairer' : roleRepairer,
        'scout' : militaryScout,
        'smartHarvester' : roleSmartHarvester,
        'defender' : militaryDefender,
        'hauler' : roleHauler
    },
}

module.exports = common;