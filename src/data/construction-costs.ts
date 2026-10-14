/**
 * Generated from public kshot-lab construction data by scripts/sync-construction-costs.mjs.
 * Source, raw labels, incomplete text prerequisites and provenance: construction-source.json.
 * No extrapolation: supported levels differ by building; inspect steps, not a universal cap.
 * Level 1..30 = normal; 31..35 = progress to TG1; ... 66..70 = progress to TG8.
 * Source powerGain is preserved, NOT guaranteed to be an incremental power gain.
 */
export interface ConstructionStep {
  level: number;
  /** Explicit atomic source transition; academy TG1 goes directly from 30 to 35. Otherwise level - 1. */
  fromLevel?: number;
  bread: number;
  wood: number;
  stone: number;
  iron: number;
  truegold: number;
  temperedTruegold: number;
  seconds: number;
  power?: number;
  requirements: Record<string, number>;
}
export interface ConstructionBuilding {
  id: string;
  name: string;
  steps: ConstructionStep[];
}
/** Reference UI lower bound; source contains earlier levels with incomplete prerequisites. */
export const CONSTRUCTION_REFERENCE_MIN_LEVEL = 25;
export const CONSTRUCTION_REFERENCE_SUPPORT_IDS = ["academy","embassy","barracks","range","stable","commandcenter"] as const;
export const CONSTRUCTION_BUILDINGS: ConstructionBuilding[] = [
  {
    "id": "town-center",
    "name": "도시센터",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 0,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 0,
        "power": 2000,
        "requirements": {}
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 180,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 6,
        "power": 3800,
        "requirements": {}
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 805,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 60,
        "power": 6500,
        "requirements": {}
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 1800,
        "stone": 360,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 180,
        "power": 10100,
        "requirements": {}
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 7600,
        "stone": 1500,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 600,
        "power": 15500,
        "requirements": {}
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 19000,
        "stone": 3800,
        "iron": 960,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1800,
        "power": 23600,
        "requirements": {}
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 69000,
        "stone": 13000,
        "iron": 3400,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3600,
        "power": 35300,
        "requirements": {}
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 120000,
        "stone": 25000,
        "iron": 6300,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9000,
        "power": 47000,
        "requirements": {
          "barracks": 7
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 260000,
        "stone": 52000,
        "iron": 13000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 16200,
        "power": 58700,
        "requirements": {
          "embassy": 8,
          "infirmary": 1
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 460000,
        "stone": 92000,
        "iron": 23000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 21600,
        "power": 75700,
        "requirements": {
          "range": 9
        }
      },
      {
        "level": 11,
        "bread": 1300000,
        "wood": 1300000,
        "stone": 20000,
        "iron": 65000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 27000,
        "power": 92700,
        "requirements": {
          "embassy": 10,
          "stable": 10
        }
      },
      {
        "level": 12,
        "bread": 1600000,
        "wood": 1600000,
        "stone": 330000,
        "iron": 84000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 32400,
        "power": 109700,
        "requirements": {
          "embassy": 11,
          "commandcenter": 1
        }
      },
      {
        "level": 13,
        "bread": 2300000,
        "wood": 2300000,
        "stone": 470000,
        "iron": 110000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 39600,
        "power": 138400,
        "requirements": {
          "embassy": 12,
          "barracks": 12
        }
      },
      {
        "level": 14,
        "bread": 3100000,
        "wood": 3100000,
        "stone": 630000,
        "iron": 150000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 50400,
        "power": 167100,
        "requirements": {
          "embassy": 13,
          "range": 13
        }
      },
      {
        "level": 15,
        "bread": 4600000,
        "wood": 4600000,
        "stone": 930000,
        "iron": 230000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 64800,
        "power": 195800,
        "requirements": {
          "embassy": 14,
          "stable": 14
        }
      },
      {
        "level": 16,
        "bread": 5900000,
        "wood": 5900000,
        "stone": 1100000,
        "iron": 290000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 109680,
        "power": 236200,
        "requirements": {
          "embassy": 15,
          "academy": 15
        }
      },
      {
        "level": 17,
        "bread": 9300000,
        "wood": 9300000,
        "stone": 1800000,
        "iron": 480000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 131640,
        "power": 276600,
        "requirements": {
          "embassy": 16,
          "barracks": 16
        }
      },
      {
        "level": 18,
        "bread": 12000000,
        "wood": 12000000,
        "stone": 2500000,
        "iron": 620000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 157980,
        "power": 317000,
        "requirements": {
          "embassy": 17,
          "range": 17
        }
      },
      {
        "level": 19,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 780000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 237000,
        "power": 374400,
        "requirements": {
          "embassy": 18,
          "stable": 18
        }
      },
      {
        "level": 20,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 296280,
        "power": 431800,
        "requirements": {
          "embassy": 19,
          "academy": 19
        }
      },
      {
        "level": 21,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5400000,
        "iron": 1300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 385140,
        "power": 489200,
        "requirements": {
          "embassy": 20,
          "barracks": 20
        }
      },
      {
        "level": 22,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7200000,
        "iron": 1800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 577740,
        "power": 575300,
        "requirements": {
          "embassy": 21,
          "range": 21
        }
      },
      {
        "level": 23,
        "bread": 44000000,
        "wood": 44000000,
        "stone": 8900000,
        "iron": 2200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 808800,
        "power": 661400,
        "requirements": {
          "embassy": 22,
          "stable": 22
        }
      },
      {
        "level": 24,
        "bread": 60000000,
        "wood": 60000000,
        "stone": 12000000,
        "iron": 3000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1132380,
        "power": 747500,
        "requirements": {
          "embassy": 23,
          "academy": 23
        }
      },
      {
        "level": 25,
        "bread": 81000000,
        "wood": 81000000,
        "stone": 16000000,
        "iron": 4000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1585320,
        "power": 833600,
        "requirements": {
          "embassy": 24,
          "barracks": 24
        }
      },
      {
        "level": 26,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1823160,
        "power": 960100,
        "requirements": {
          "embassy": 25,
          "range": 25
        }
      },
      {
        "level": 27,
        "bread": 140000000,
        "wood": 140000000,
        "stone": 24000000,
        "iron": 7400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2187780,
        "power": 1086600,
        "requirements": {
          "embassy": 26,
          "stable": 26
        }
      },
      {
        "level": 28,
        "bread": 190000000,
        "wood": 190000000,
        "stone": 39000000,
        "iron": 9900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2515920,
        "power": 1213100,
        "requirements": {
          "embassy": 27,
          "academy": 27
        }
      },
      {
        "level": 29,
        "bread": 240000000,
        "wood": 240000000,
        "stone": 49000000,
        "iron": 12000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2893320,
        "power": 1339600,
        "requirements": {
          "embassy": 28,
          "barracks": 28
        }
      },
      {
        "level": 30,
        "bread": 300000000,
        "wood": 300000000,
        "stone": 60000000,
        "iron": 15000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3472020,
        "power": 1523500,
        "requirements": {
          "embassy": 29,
          "range": 29
        }
      },
      {
        "level": 31,
        "bread": 67000000,
        "wood": 67000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 132,
        "temperedTruegold": 0,
        "seconds": 604800,
        "power": 0,
        "requirements": {
          "embassy": 30,
          "academy": 30
        }
      },
      {
        "level": 32,
        "bread": 67000000,
        "wood": 67000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 132,
        "temperedTruegold": 0,
        "seconds": 604800,
        "power": 0,
        "requirements": {
          "embassy": 30,
          "academy": 30
        }
      },
      {
        "level": 33,
        "bread": 67000000,
        "wood": 67000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 132,
        "temperedTruegold": 0,
        "seconds": 604800,
        "power": 0,
        "requirements": {
          "embassy": 30,
          "academy": 30
        }
      },
      {
        "level": 34,
        "bread": 67000000,
        "wood": 67000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 132,
        "temperedTruegold": 0,
        "seconds": 604800,
        "power": 0,
        "requirements": {
          "embassy": 30,
          "academy": 30
        }
      },
      {
        "level": 35,
        "bread": 67000000,
        "wood": 67000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 132,
        "temperedTruegold": 0,
        "seconds": 604800,
        "power": 1810500,
        "requirements": {
          "embassy": 30,
          "academy": 30
        }
      },
      {
        "level": 36,
        "bread": 72000000,
        "wood": 72000000,
        "stone": 14000000,
        "iron": 3600000,
        "truegold": 158,
        "temperedTruegold": 0,
        "seconds": 777600,
        "power": 0,
        "requirements": {
          "embassy": 35,
          "stable": 35
        }
      },
      {
        "level": 37,
        "bread": 72000000,
        "wood": 72000000,
        "stone": 14000000,
        "iron": 3600000,
        "truegold": 158,
        "temperedTruegold": 0,
        "seconds": 777600,
        "power": 0,
        "requirements": {
          "embassy": 35,
          "stable": 35
        }
      },
      {
        "level": 38,
        "bread": 72000000,
        "wood": 72000000,
        "stone": 14000000,
        "iron": 3600000,
        "truegold": 158,
        "temperedTruegold": 0,
        "seconds": 777600,
        "power": 0,
        "requirements": {
          "embassy": 35,
          "stable": 35
        }
      },
      {
        "level": 39,
        "bread": 72000000,
        "wood": 72000000,
        "stone": 14000000,
        "iron": 3600000,
        "truegold": 158,
        "temperedTruegold": 0,
        "seconds": 777600,
        "power": 0,
        "requirements": {
          "embassy": 35,
          "stable": 35
        }
      },
      {
        "level": 40,
        "bread": 72000000,
        "wood": 72000000,
        "stone": 14000000,
        "iron": 3600000,
        "truegold": 158,
        "temperedTruegold": 0,
        "seconds": 777600,
        "power": 2097500,
        "requirements": {
          "embassy": 35,
          "stable": 35
        }
      },
      {
        "level": 41,
        "bread": 79000000,
        "wood": 79000000,
        "stone": 15000000,
        "iron": 3900000,
        "truegold": 238,
        "temperedTruegold": 0,
        "seconds": 950400,
        "power": 0,
        "requirements": {
          "embassy": 40,
          "barracks": 40
        }
      },
      {
        "level": 42,
        "bread": 79000000,
        "wood": 79000000,
        "stone": 15000000,
        "iron": 3900000,
        "truegold": 238,
        "temperedTruegold": 0,
        "seconds": 950400,
        "power": 0,
        "requirements": {
          "embassy": 40,
          "barracks": 40
        }
      },
      {
        "level": 43,
        "bread": 79000000,
        "wood": 79000000,
        "stone": 15000000,
        "iron": 3900000,
        "truegold": 238,
        "temperedTruegold": 0,
        "seconds": 950400,
        "power": 0,
        "requirements": {
          "embassy": 40,
          "barracks": 40
        }
      },
      {
        "level": 44,
        "bread": 79000000,
        "wood": 79000000,
        "stone": 15000000,
        "iron": 3900000,
        "truegold": 238,
        "temperedTruegold": 0,
        "seconds": 950400,
        "power": 0,
        "requirements": {
          "embassy": 40,
          "barracks": 40
        }
      },
      {
        "level": 45,
        "bread": 79000000,
        "wood": 79000000,
        "stone": 15000000,
        "iron": 3900000,
        "truegold": 238,
        "temperedTruegold": 0,
        "seconds": 950400,
        "power": 2384500,
        "requirements": {
          "embassy": 40,
          "barracks": 40
        }
      },
      {
        "level": 46,
        "bread": 82000000,
        "wood": 82000000,
        "stone": 16000000,
        "iron": 4100000,
        "truegold": 280,
        "temperedTruegold": 0,
        "seconds": 1036800,
        "power": 0,
        "requirements": {
          "embassy": 45,
          "range": 45
        }
      },
      {
        "level": 47,
        "bread": 82000000,
        "wood": 82000000,
        "stone": 16000000,
        "iron": 4100000,
        "truegold": 280,
        "temperedTruegold": 0,
        "seconds": 1036800,
        "power": 0,
        "requirements": {
          "embassy": 45,
          "range": 45
        }
      },
      {
        "level": 48,
        "bread": 82000000,
        "wood": 82000000,
        "stone": 16000000,
        "iron": 4100000,
        "truegold": 280,
        "temperedTruegold": 0,
        "seconds": 1036800,
        "power": 0,
        "requirements": {
          "embassy": 45,
          "range": 45
        }
      },
      {
        "level": 49,
        "bread": 82000000,
        "wood": 82000000,
        "stone": 16000000,
        "iron": 4100000,
        "truegold": 280,
        "temperedTruegold": 0,
        "seconds": 1036800,
        "power": 0,
        "requirements": {
          "embassy": 45,
          "range": 45
        }
      },
      {
        "level": 50,
        "bread": 82000000,
        "wood": 82000000,
        "stone": 16000000,
        "iron": 4100000,
        "truegold": 280,
        "temperedTruegold": 0,
        "seconds": 1036800,
        "power": 2700500,
        "requirements": {
          "embassy": 45,
          "range": 45
        }
      },
      {
        "level": 51,
        "bread": 84000000,
        "wood": 84000000,
        "stone": 16000000,
        "iron": 4200000,
        "truegold": 335,
        "temperedTruegold": 0,
        "seconds": 1209600,
        "power": 0,
        "requirements": {
          "embassy": 50,
          "stable": 50
        }
      },
      {
        "level": 52,
        "bread": 84000000,
        "wood": 84000000,
        "stone": 16000000,
        "iron": 4200000,
        "truegold": 335,
        "temperedTruegold": 0,
        "seconds": 1209600,
        "power": 0,
        "requirements": {
          "embassy": 50,
          "stable": 50
        }
      },
      {
        "level": 53,
        "bread": 84000000,
        "wood": 84000000,
        "stone": 16000000,
        "iron": 4200000,
        "truegold": 335,
        "temperedTruegold": 0,
        "seconds": 1209600,
        "power": 0,
        "requirements": {
          "embassy": 50,
          "stable": 50
        }
      },
      {
        "level": 54,
        "bread": 84000000,
        "wood": 84000000,
        "stone": 16000000,
        "iron": 4200000,
        "truegold": 335,
        "temperedTruegold": 0,
        "seconds": 1209600,
        "power": 0,
        "requirements": {
          "embassy": 50,
          "stable": 50
        }
      },
      {
        "level": 55,
        "bread": 84000000,
        "wood": 84000000,
        "stone": 16000000,
        "iron": 4200000,
        "truegold": 335,
        "temperedTruegold": 0,
        "seconds": 1209600,
        "power": 3016500,
        "requirements": {
          "embassy": 50,
          "stable": 50
        }
      },
      {
        "level": 56,
        "bread": 96000000,
        "wood": 96000000,
        "stone": 19000000,
        "iron": 4800000,
        "truegold": 200,
        "temperedTruegold": 10,
        "seconds": 1296000,
        "power": 0,
        "requirements": {
          "embassy": 55,
          "barracks": 55
        }
      },
      {
        "level": 57,
        "bread": 96000000,
        "wood": 96000000,
        "stone": 19000000,
        "iron": 4800000,
        "truegold": 200,
        "temperedTruegold": 10,
        "seconds": 1296000,
        "power": 0,
        "requirements": {
          "embassy": 55,
          "barracks": 55
        }
      },
      {
        "level": 58,
        "bread": 96000000,
        "wood": 96000000,
        "stone": 19000000,
        "iron": 4800000,
        "truegold": 200,
        "temperedTruegold": 10,
        "seconds": 1296000,
        "power": 0,
        "requirements": {
          "embassy": 55,
          "barracks": 55
        }
      },
      {
        "level": 59,
        "bread": 96000000,
        "wood": 96000000,
        "stone": 19000000,
        "iron": 4800000,
        "truegold": 200,
        "temperedTruegold": 10,
        "seconds": 1296000,
        "power": 0,
        "requirements": {
          "embassy": 55,
          "barracks": 55
        }
      },
      {
        "level": 60,
        "bread": 96000000,
        "wood": 96000000,
        "stone": 19000000,
        "iron": 4800000,
        "truegold": 100,
        "temperedTruegold": 20,
        "seconds": 1296000,
        "power": 3354500,
        "requirements": {
          "embassy": 55,
          "barracks": 55
        }
      },
      {
        "level": 61,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5400000,
        "truegold": 240,
        "temperedTruegold": 15,
        "seconds": 1555200,
        "power": 0,
        "requirements": {
          "embassy": 60,
          "range": 60
        }
      },
      {
        "level": 62,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5400000,
        "truegold": 240,
        "temperedTruegold": 15,
        "seconds": 1555200,
        "power": 0,
        "requirements": {
          "embassy": 60,
          "range": 60
        }
      },
      {
        "level": 63,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5400000,
        "truegold": 240,
        "temperedTruegold": 15,
        "seconds": 1555200,
        "power": 0,
        "requirements": {
          "embassy": 60,
          "range": 60
        }
      },
      {
        "level": 64,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5400000,
        "truegold": 240,
        "temperedTruegold": 15,
        "seconds": 1555200,
        "power": 0,
        "requirements": {
          "embassy": 60,
          "range": 60
        }
      },
      {
        "level": 65,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5400000,
        "truegold": 120,
        "temperedTruegold": 30,
        "seconds": 1555200,
        "power": 3692500,
        "requirements": {
          "embassy": 60,
          "range": 60
        }
      },
      {
        "level": 66,
        "bread": 130000000,
        "wood": 130000000,
        "stone": 26000000,
        "iron": 6600000,
        "truegold": 240,
        "temperedTruegold": 20,
        "seconds": 1728000,
        "power": 0,
        "requirements": {
          "embassy": 65,
          "stable": 65
        }
      },
      {
        "level": 67,
        "bread": 130000000,
        "wood": 130000000,
        "stone": 26000000,
        "iron": 6600000,
        "truegold": 240,
        "temperedTruegold": 20,
        "seconds": 1728000,
        "power": 0,
        "requirements": {
          "embassy": 65,
          "stable": 65
        }
      },
      {
        "level": 68,
        "bread": 130000000,
        "wood": 130000000,
        "stone": 26000000,
        "iron": 6600000,
        "truegold": 240,
        "temperedTruegold": 20,
        "seconds": 1728000,
        "power": 0,
        "requirements": {
          "embassy": 65,
          "stable": 65
        }
      },
      {
        "level": 69,
        "bread": 130000000,
        "wood": 130000000,
        "stone": 26000000,
        "iron": 6600000,
        "truegold": 240,
        "temperedTruegold": 20,
        "seconds": 1728000,
        "power": 0,
        "requirements": {
          "embassy": 65,
          "stable": 65
        }
      },
      {
        "level": 70,
        "bread": 130000000,
        "wood": 130000000,
        "stone": 26000000,
        "iron": 6600000,
        "truegold": 120,
        "temperedTruegold": 40,
        "seconds": 1728000,
        "power": 4030500,
        "requirements": {
          "embassy": 65,
          "stable": 65
        }
      }
    ]
  },
  {
    "id": "academy",
    "name": "아카데미",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 105,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 160,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 725,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 45,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 1600,
        "stone": 320,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 135,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 6800,
        "stone": 1300,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 270,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 17000,
        "stone": 3400,
        "iron": 860,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 540,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 62000,
        "stone": 12000,
        "iron": 3100,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1080,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 110000,
        "stone": 22000,
        "iron": 5600,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1620,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 230000,
        "stone": 47000,
        "iron": 11000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2430,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 410000,
        "stone": 82000,
        "iron": 20000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3240,
        "power": 0,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 11,
        "bread": 520000,
        "wood": 520000,
        "stone": 100000,
        "iron": 26000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4050,
        "power": 0,
        "requirements": {
          "town-center": 11
        }
      },
      {
        "level": 12,
        "bread": 670000,
        "wood": 670000,
        "stone": 130000,
        "iron": 33000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4860,
        "power": 0,
        "requirements": {
          "town-center": 12
        }
      },
      {
        "level": 13,
        "bread": 950000,
        "wood": 950000,
        "stone": 190000,
        "iron": 47000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 5940,
        "power": 0,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 14,
        "bread": 1200000,
        "wood": 1200000,
        "stone": 250000,
        "iron": 63000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7560,
        "power": 0,
        "requirements": {
          "town-center": 14
        }
      },
      {
        "level": 15,
        "bread": 1800000,
        "wood": 1800000,
        "stone": 370000,
        "iron": 93000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9720,
        "power": 0,
        "requirements": {
          "town-center": 15
        }
      },
      {
        "level": 16,
        "bread": 2300000,
        "wood": 2300000,
        "stone": 470000,
        "iron": 110000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 16440,
        "power": 0,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 17,
        "bread": 3700000,
        "wood": 3700000,
        "stone": 740000,
        "iron": 180000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 19740,
        "power": 0,
        "requirements": {
          "town-center": 17
        }
      },
      {
        "level": 18,
        "bread": 5000000,
        "wood": 5000000,
        "stone": 1000000,
        "iron": 250000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 23700,
        "power": 0,
        "requirements": {
          "town-center": 18
        }
      },
      {
        "level": 19,
        "bread": 6200000,
        "wood": 6200000,
        "stone": 1200000,
        "iron": 310000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35520,
        "power": 0,
        "requirements": {
          "town-center": 19
        }
      },
      {
        "level": 20,
        "bread": 8600000,
        "wood": 8600000,
        "stone": 1700000,
        "iron": 430000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 44430,
        "power": 0,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 21,
        "bread": 10000000,
        "wood": 10000000,
        "stone": 2100000,
        "iron": 540000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 57750,
        "power": 0,
        "requirements": {
          "town-center": 21
        }
      },
      {
        "level": 22,
        "bread": 14000000,
        "wood": 14000000,
        "stone": 2800000,
        "iron": 720000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 86640,
        "power": 0,
        "requirements": {
          "town-center": 22
        }
      },
      {
        "level": 23,
        "bread": 17000000,
        "wood": 17000000,
        "stone": 3500000,
        "iron": 890000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 121320,
        "power": 0,
        "requirements": {
          "town-center": 23
        }
      },
      {
        "level": 24,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4800000,
        "iron": 1200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169860,
        "power": 0,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 25,
        "bread": 32000000,
        "wood": 32000000,
        "stone": 6500000,
        "iron": 1600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 237780,
        "power": 0,
        "requirements": {
          "town-center": 25
        }
      },
      {
        "level": 26,
        "bread": 42000000,
        "wood": 42000000,
        "stone": 8400000,
        "iron": 2100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 273420,
        "power": 0,
        "requirements": {
          "town-center": 26
        }
      },
      {
        "level": 27,
        "bread": 59000000,
        "wood": 59000000,
        "stone": 11000000,
        "iron": 2900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 328140,
        "power": 0,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 28,
        "bread": 79000000,
        "wood": 79000000,
        "stone": 15000000,
        "iron": 3900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 377340,
        "power": 0,
        "requirements": {
          "town-center": 28
        }
      },
      {
        "level": 29,
        "bread": 98000000,
        "wood": 98000000,
        "stone": 19000000,
        "iron": 4900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 433980,
        "power": 0,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 30,
        "bread": 120000000,
        "wood": 120000000,
        "stone": 24000000,
        "iron": 6000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 520800,
        "power": 0,
        "requirements": {
          "town-center": 30
        }
      },
      {
        "level": 35,
        "fromLevel": 30,
        "bread": 0,
        "wood": 0,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 217260,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 36,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7200000,
        "iron": 1800000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 224148,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 37,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7200000,
        "iron": 1800000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 231036,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 38,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7200000,
        "iron": 1800000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 237924,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 39,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7200000,
        "iron": 1800000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 244812,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 40,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7200000,
        "iron": 1800000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 251700,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 41,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 190080,
        "power": 258588,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 42,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 190080,
        "power": 265476,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 43,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 190080,
        "power": 272364,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 44,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 190080,
        "power": 279252,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 45,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 190080,
        "power": 286140,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 46,
        "bread": 41000000,
        "wood": 41000000,
        "stone": 8200000,
        "iron": 2000000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 207360,
        "power": 293724,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 47,
        "bread": 41000000,
        "wood": 41000000,
        "stone": 8200000,
        "iron": 2000000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 207360,
        "power": 301308,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 48,
        "bread": 41000000,
        "wood": 41000000,
        "stone": 8200000,
        "iron": 2000000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 207360,
        "power": 308892,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 49,
        "bread": 41000000,
        "wood": 41000000,
        "stone": 8200000,
        "iron": 2000000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 207360,
        "power": 316476,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 50,
        "bread": 41000000,
        "wood": 41000000,
        "stone": 8200000,
        "iron": 2000000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 207360,
        "power": 324060,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 51,
        "bread": 42000000,
        "wood": 42000000,
        "stone": 8200000,
        "iron": 2100000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 331644,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 52,
        "bread": 42000000,
        "wood": 42000000,
        "stone": 8200000,
        "iron": 2100000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 339228,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 53,
        "bread": 42000000,
        "wood": 42000000,
        "stone": 8200000,
        "iron": 2100000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 346812,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 54,
        "bread": 42000000,
        "wood": 42000000,
        "stone": 8200000,
        "iron": 2100000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 354396,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 55,
        "bread": 42000000,
        "wood": 42000000,
        "stone": 8200000,
        "iron": 2100000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 361980,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 56,
        "bread": 48000000,
        "wood": 48000000,
        "stone": 9600000,
        "iron": 2400000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 259200,
        "power": 370092,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 57,
        "bread": 48000000,
        "wood": 48000000,
        "stone": 9600000,
        "iron": 2400000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 259200,
        "power": 378204,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 58,
        "bread": 48000000,
        "wood": 48000000,
        "stone": 9600000,
        "iron": 2400000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 259200,
        "power": 386316,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 59,
        "bread": 48000000,
        "wood": 48000000,
        "stone": 9600000,
        "iron": 2400000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 259200,
        "power": 394428,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 60,
        "bread": 48000000,
        "wood": 48000000,
        "stone": 9600000,
        "iron": 2400000,
        "truegold": 45,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 402540,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 61,
        "bread": 54000000,
        "wood": 54000000,
        "stone": 10000000,
        "iron": 2700000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 311040,
        "power": 410652,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 62,
        "bread": 54000000,
        "wood": 54000000,
        "stone": 10000000,
        "iron": 2700000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 311040,
        "power": 418764,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 63,
        "bread": 54000000,
        "wood": 54000000,
        "stone": 10000000,
        "iron": 2700000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 311040,
        "power": 426876,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 64,
        "bread": 54000000,
        "wood": 54000000,
        "stone": 10000000,
        "iron": 2700000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 311040,
        "power": 434988,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 65,
        "bread": 54000000,
        "wood": 54000000,
        "stone": 10000000,
        "iron": 2700000,
        "truegold": 54,
        "temperedTruegold": 13,
        "seconds": 311040,
        "power": 443100,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 66,
        "bread": 66000000,
        "wood": 66000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 345600,
        "power": 451212,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 67,
        "bread": 66000000,
        "wood": 66000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 345600,
        "power": 459324,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 68,
        "bread": 66000000,
        "wood": 66000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 345600,
        "power": 467436,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 69,
        "bread": 66000000,
        "wood": 66000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 345600,
        "power": 475548,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 70,
        "bread": 66000000,
        "wood": 66000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 54,
        "temperedTruegold": 18,
        "seconds": 345600,
        "power": 483660,
        "requirements": {
          "town-center": 70
        }
      }
    ]
  },
  {
    "id": "embassy",
    "name": "대사관",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 60,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 90,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 10,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 400,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 60,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 900,
        "stone": 180,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 120,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 3800,
        "stone": 760,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 400,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 9600,
        "stone": 1900,
        "iron": 480,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 800,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 34000,
        "stone": 6900,
        "iron": 1700,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1500,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 63000,
        "stone": 12000,
        "iron": 3100,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2700,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 130000,
        "stone": 26000,
        "iron": 6500,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7200,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 230000,
        "stone": 46000,
        "iron": 11000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 14250,
        "power": 0,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 11,
        "bread": 260000,
        "wood": 260000,
        "stone": 52000,
        "iron": 13000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 17820,
        "power": 0,
        "requirements": {
          "town-center": 11
        }
      },
      {
        "level": 12,
        "bread": 330000,
        "wood": 330000,
        "stone": 67000,
        "iron": 16000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 21360,
        "power": 0,
        "requirements": {
          "town-center": 12
        }
      },
      {
        "level": 13,
        "bread": 470000,
        "wood": 470000,
        "stone": 95000,
        "iron": 23000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 26130,
        "power": 0,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 14,
        "bread": 630000,
        "wood": 630000,
        "stone": 120000,
        "iron": 31000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 33240,
        "power": 0,
        "requirements": {
          "town-center": 14
        }
      },
      {
        "level": 15,
        "bread": 930000,
        "wood": 930000,
        "stone": 180000,
        "iron": 46000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 42750,
        "power": 0,
        "requirements": {
          "town-center": 15
        }
      },
      {
        "level": 16,
        "bread": 1100000,
        "wood": 1100000,
        "stone": 230000,
        "iron": 59000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 71000,
        "power": 0,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 17,
        "bread": 1800000,
        "wood": 1800000,
        "stone": 370000,
        "iron": 93000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 86880,
        "power": 0,
        "requirements": {
          "town-center": 17
        }
      },
      {
        "level": 18,
        "bread": 2500000,
        "wood": 2500000,
        "stone": 500000,
        "iron": 120000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 104280,
        "power": 0,
        "requirements": {
          "town-center": 18
        }
      },
      {
        "level": 19,
        "bread": 3100000,
        "wood": 3100000,
        "stone": 620000,
        "iron": 150000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 156420,
        "power": 0,
        "requirements": {
          "town-center": 19
        }
      },
      {
        "level": 20,
        "bread": 4300000,
        "wood": 4300000,
        "stone": 860000,
        "iron": 210000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 195540,
        "power": 0,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 21,
        "bread": 5400000,
        "wood": 5400000,
        "stone": 1000000,
        "iron": 270000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 254160,
        "power": 0,
        "requirements": {
          "town-center": 21
        }
      },
      {
        "level": 22,
        "bread": 7200000,
        "wood": 7200000,
        "stone": 1400000,
        "iron": 360000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 381300,
        "power": 0,
        "requirements": {
          "town-center": 22
        }
      },
      {
        "level": 23,
        "bread": 8900000,
        "wood": 8900000,
        "stone": 1700000,
        "iron": 440000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 533820,
        "power": 0,
        "requirements": {
          "town-center": 23
        }
      },
      {
        "level": 24,
        "bread": 12000000,
        "wood": 12000000,
        "stone": 2400000,
        "iron": 600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 747360,
        "power": 0,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 25,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3200000,
        "iron": 810000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1046280,
        "power": 0,
        "requirements": {
          "town-center": 25
        }
      },
      {
        "level": 26,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1203240,
        "power": 0,
        "requirements": {
          "town-center": 26
        }
      },
      {
        "level": 27,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1443900,
        "power": 0,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 28,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1660500,
        "power": 0,
        "requirements": {
          "town-center": 28
        }
      },
      {
        "level": 29,
        "bread": 49000000,
        "wood": 49000000,
        "stone": 9800000,
        "iron": 2400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1909560,
        "power": 0,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 30,
        "bread": 60000000,
        "wood": 60000000,
        "stone": 12000000,
        "iron": 3000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2291520,
        "power": 0,
        "requirements": {
          "town-center": 30
        }
      },
      {
        "level": 31,
        "bread": 13000000,
        "wood": 13000000,
        "stone": 2700000,
        "iron": 670000,
        "truegold": 33,
        "temperedTruegold": 0,
        "seconds": 399120,
        "power": 347798,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 32,
        "bread": 13000000,
        "wood": 13000000,
        "stone": 2700000,
        "iron": 670000,
        "truegold": 33,
        "temperedTruegold": 0,
        "seconds": 399120,
        "power": 360426,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 33,
        "bread": 13000000,
        "wood": 13000000,
        "stone": 2700000,
        "iron": 670000,
        "truegold": 33,
        "temperedTruegold": 0,
        "seconds": 399120,
        "power": 373054,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 34,
        "bread": 13000000,
        "wood": 13000000,
        "stone": 2700000,
        "iron": 670000,
        "truegold": 33,
        "temperedTruegold": 0,
        "seconds": 399120,
        "power": 385682,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 35,
        "bread": 13000000,
        "wood": 13000000,
        "stone": 2700000,
        "iron": 670000,
        "truegold": 33,
        "temperedTruegold": 0,
        "seconds": 399120,
        "power": 398310,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 36,
        "bread": 14000000,
        "wood": 14000000,
        "stone": 2900000,
        "iron": 720000,
        "truegold": 39,
        "temperedTruegold": 0,
        "seconds": 513180,
        "power": 410938,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 37,
        "bread": 14000000,
        "wood": 14000000,
        "stone": 2900000,
        "iron": 720000,
        "truegold": 39,
        "temperedTruegold": 0,
        "seconds": 513180,
        "power": 423566,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 38,
        "bread": 14000000,
        "wood": 14000000,
        "stone": 2900000,
        "iron": 720000,
        "truegold": 39,
        "temperedTruegold": 0,
        "seconds": 513180,
        "power": 436194,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 39,
        "bread": 14000000,
        "wood": 14000000,
        "stone": 2900000,
        "iron": 720000,
        "truegold": 39,
        "temperedTruegold": 0,
        "seconds": 513180,
        "power": 448822,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 40,
        "bread": 14000000,
        "wood": 14000000,
        "stone": 2900000,
        "iron": 720000,
        "truegold": 39,
        "temperedTruegold": 0,
        "seconds": 513180,
        "power": 461450,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 41,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 790000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 627240,
        "power": 474087,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 42,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 790000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 627240,
        "power": 486706,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 43,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 790000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 627240,
        "power": 499334,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 44,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 790000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 627240,
        "power": 511962,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 45,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 790000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 627240,
        "power": 524590,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 46,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3200000,
        "iron": 820000,
        "truegold": 70,
        "temperedTruegold": 0,
        "seconds": 684240,
        "power": 538494,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 47,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3200000,
        "iron": 820000,
        "truegold": 70,
        "temperedTruegold": 0,
        "seconds": 684240,
        "power": 552398,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 48,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3200000,
        "iron": 820000,
        "truegold": 70,
        "temperedTruegold": 0,
        "seconds": 684240,
        "power": 566302,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 49,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3200000,
        "iron": 820000,
        "truegold": 70,
        "temperedTruegold": 0,
        "seconds": 684240,
        "power": 580206,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 50,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3200000,
        "iron": 820000,
        "truegold": 70,
        "temperedTruegold": 0,
        "seconds": 684240,
        "power": 594110,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 51,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 83,
        "temperedTruegold": 0,
        "seconds": 798300,
        "power": 608014,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 52,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 83,
        "temperedTruegold": 0,
        "seconds": 798300,
        "power": 621918,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 53,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 83,
        "temperedTruegold": 0,
        "seconds": 798300,
        "power": 635822,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 54,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 83,
        "temperedTruegold": 0,
        "seconds": 798300,
        "power": 649726,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 55,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 83,
        "temperedTruegold": 0,
        "seconds": 798300,
        "power": 663630,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 56,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3800000,
        "iron": 960000,
        "truegold": 50,
        "temperedTruegold": 2,
        "seconds": 855360,
        "power": 678502,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 57,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3800000,
        "iron": 960000,
        "truegold": 50,
        "temperedTruegold": 2,
        "seconds": 855360,
        "power": 693374,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 58,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3800000,
        "iron": 960000,
        "truegold": 50,
        "temperedTruegold": 2,
        "seconds": 855360,
        "power": 708246,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 59,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3800000,
        "iron": 960000,
        "truegold": 50,
        "temperedTruegold": 2,
        "seconds": 855360,
        "power": 723118,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 60,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3800000,
        "iron": 960000,
        "truegold": 25,
        "temperedTruegold": 5,
        "seconds": 855360,
        "power": 737990,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 61,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 60,
        "temperedTruegold": 3,
        "seconds": 1026420,
        "power": 752862,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 62,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 60,
        "temperedTruegold": 3,
        "seconds": 1026420,
        "power": 767734,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 63,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 60,
        "temperedTruegold": 3,
        "seconds": 1026420,
        "power": 782606,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 64,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 60,
        "temperedTruegold": 3,
        "seconds": 1026420,
        "power": 797478,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 65,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 30,
        "temperedTruegold": 7,
        "seconds": 1026420,
        "power": 812350,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 66,
        "bread": 26000000,
        "wood": 26000000,
        "stone": 5300000,
        "iron": 1300000,
        "truegold": 60,
        "temperedTruegold": 5,
        "seconds": 1140480,
        "power": 827222,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 67,
        "bread": 26000000,
        "wood": 26000000,
        "stone": 5300000,
        "iron": 1300000,
        "truegold": 60,
        "temperedTruegold": 5,
        "seconds": 1140480,
        "power": 842094,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 68,
        "bread": 26000000,
        "wood": 26000000,
        "stone": 5300000,
        "iron": 1300000,
        "truegold": 60,
        "temperedTruegold": 5,
        "seconds": 1140480,
        "power": 856966,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 69,
        "bread": 26000000,
        "wood": 26000000,
        "stone": 5300000,
        "iron": 1300000,
        "truegold": 60,
        "temperedTruegold": 5,
        "seconds": 1140480,
        "power": 871838,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 70,
        "bread": 26000000,
        "wood": 26000000,
        "stone": 5300000,
        "iron": 1300000,
        "truegold": 30,
        "temperedTruegold": 10,
        "seconds": 1140480,
        "power": 0,
        "requirements": {
          "town-center": 70
        }
      }
    ]
  },
  {
    "id": "barracks",
    "name": "보병대",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 0,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 140,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 645,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 45,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 1400,
        "stone": 285,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 125,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 6000,
        "stone": 1200,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 270,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 15000,
        "stone": 3000,
        "iron": 765,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 540,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 55000,
        "stone": 11000,
        "iron": 2700,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1080,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 100000,
        "stone": 20000,
        "iron": 5000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1620,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 200000,
        "stone": 41000,
        "iron": 10000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2430,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 360000,
        "stone": 73000,
        "iron": 18000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3240,
        "power": 0,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 11,
        "bread": 460000,
        "wood": 460000,
        "stone": 92000,
        "iron": 23000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4050,
        "power": 0,
        "requirements": {
          "town-center": 11
        }
      },
      {
        "level": 12,
        "bread": 580000,
        "wood": 580000,
        "stone": 110000,
        "iron": 29000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4860,
        "power": 0,
        "requirements": {
          "town-center": 12
        }
      },
      {
        "level": 13,
        "bread": 830000,
        "wood": 830000,
        "stone": 160000,
        "iron": 41000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 5940,
        "power": 0,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 14,
        "bread": 1100000,
        "wood": 1100000,
        "stone": 220000,
        "iron": 55000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7560,
        "power": 0,
        "requirements": {
          "town-center": 14
        }
      },
      {
        "level": 15,
        "bread": 1600000,
        "wood": 1600000,
        "stone": 320000,
        "iron": 81000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9720,
        "power": 0,
        "requirements": {
          "town-center": 15
        }
      },
      {
        "level": 16,
        "bread": 2000000,
        "wood": 2000000,
        "stone": 410000,
        "iron": 100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 16440,
        "power": 0,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 17,
        "bread": 3200000,
        "wood": 3200000,
        "stone": 650000,
        "iron": 160000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 19740,
        "power": 0,
        "requirements": {
          "town-center": 17
        }
      },
      {
        "level": 18,
        "bread": 4300000,
        "wood": 4300000,
        "stone": 870000,
        "iron": 210000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 23700,
        "power": 0,
        "requirements": {
          "town-center": 18
        }
      },
      {
        "level": 19,
        "bread": 5400000,
        "wood": 5400000,
        "stone": 1000000,
        "iron": 270000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35520,
        "power": 0,
        "requirements": {
          "town-center": 19
        }
      },
      {
        "level": 20,
        "bread": 7500000,
        "wood": 7500000,
        "stone": 1500000,
        "iron": 370000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 44430,
        "power": 0,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 21,
        "bread": 9500000,
        "wood": 9500000,
        "stone": 1900000,
        "iron": 470000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 57750,
        "power": 0,
        "requirements": {
          "town-center": 21
        }
      },
      {
        "level": 22,
        "bread": 12000000,
        "wood": 12000000,
        "stone": 2500000,
        "iron": 630000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 86640,
        "power": 0,
        "requirements": {
          "town-center": 22
        }
      },
      {
        "level": 23,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 780000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 121320,
        "power": 0,
        "requirements": {
          "town-center": 23
        }
      },
      {
        "level": 24,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169860,
        "power": 0,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 25,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 237780,
        "power": 0,
        "requirements": {
          "town-center": 25
        }
      },
      {
        "level": 26,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7300000,
        "iron": 1800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 273420,
        "power": 0,
        "requirements": {
          "town-center": 26
        }
      },
      {
        "level": 27,
        "bread": 52000000,
        "wood": 52000000,
        "stone": 10000000,
        "iron": 2600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 328140,
        "power": 0,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 28,
        "bread": 69000000,
        "wood": 69000000,
        "stone": 13000000,
        "iron": 3400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 377340,
        "power": 0,
        "requirements": {
          "town-center": 28
        }
      },
      {
        "level": 29,
        "bread": 86000000,
        "wood": 86000000,
        "stone": 17000000,
        "iron": 4300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 433980,
        "power": 0,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 30,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 520800,
        "power": 0,
        "requirements": {
          "town-center": 30
        }
      },
      {
        "level": 31,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 316180,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 32,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 327660,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 33,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 339140,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 34,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 350620,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 35,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 362100,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 36,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 373580,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 37,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 385060,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 38,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 396540,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 39,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 408020,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 40,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 419500,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 41,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 430980,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 42,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 442460,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 43,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 453940,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 44,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 465420,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 45,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 476900,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 46,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 489540,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 47,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 502180,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 48,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 514820,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 49,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 527460,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 50,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 540100,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 51,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 552740,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 52,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 565380,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 53,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 578020,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 54,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 590660,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 55,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 603300,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 56,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 616820,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 57,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 630340,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 58,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 643860,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 59,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 657380,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 60,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 45,
        "temperedTruegold": 9,
        "seconds": 194400,
        "power": 670900,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 61,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 684420,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 62,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 697940,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 63,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 711460,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 64,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 724980,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 65,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 54,
        "temperedTruegold": 13,
        "seconds": 233280,
        "power": 738500,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 66,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 752020,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 67,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 765540,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 68,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 779060,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 69,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 792580,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 70,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 54,
        "temperedTruegold": 18,
        "seconds": 259200,
        "power": 806100,
        "requirements": {
          "town-center": 70
        }
      }
    ]
  },
  {
    "id": "range",
    "name": "궁병대",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 0,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 140,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 645,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 45,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 1400,
        "stone": 285,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 125,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 6000,
        "stone": 1200,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 270,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 15000,
        "stone": 3000,
        "iron": 765,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 540,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 55000,
        "stone": 11000,
        "iron": 2700,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1080,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 100000,
        "stone": 20000,
        "iron": 5000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1620,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 200000,
        "stone": 41000,
        "iron": 10000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2430,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 360000,
        "stone": 73000,
        "iron": 18000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3240,
        "power": 0,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 11,
        "bread": 460000,
        "wood": 460000,
        "stone": 92000,
        "iron": 23000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4050,
        "power": 0,
        "requirements": {
          "town-center": 11
        }
      },
      {
        "level": 12,
        "bread": 580000,
        "wood": 580000,
        "stone": 110000,
        "iron": 29000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4860,
        "power": 0,
        "requirements": {
          "town-center": 12
        }
      },
      {
        "level": 13,
        "bread": 830000,
        "wood": 830000,
        "stone": 160000,
        "iron": 41000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 5940,
        "power": 0,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 14,
        "bread": 1100000,
        "wood": 1100000,
        "stone": 220000,
        "iron": 55000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7560,
        "power": 0,
        "requirements": {
          "town-center": 14
        }
      },
      {
        "level": 15,
        "bread": 1600000,
        "wood": 1600000,
        "stone": 320000,
        "iron": 81000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9720,
        "power": 0,
        "requirements": {
          "town-center": 15
        }
      },
      {
        "level": 16,
        "bread": 2000000,
        "wood": 2000000,
        "stone": 410000,
        "iron": 100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 16440,
        "power": 0,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 17,
        "bread": 3200000,
        "wood": 3200000,
        "stone": 650000,
        "iron": 160000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 19740,
        "power": 0,
        "requirements": {
          "town-center": 17
        }
      },
      {
        "level": 18,
        "bread": 4300000,
        "wood": 4300000,
        "stone": 870000,
        "iron": 210000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 23700,
        "power": 0,
        "requirements": {
          "town-center": 18
        }
      },
      {
        "level": 19,
        "bread": 5400000,
        "wood": 5400000,
        "stone": 1000000,
        "iron": 270000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35520,
        "power": 0,
        "requirements": {
          "town-center": 19
        }
      },
      {
        "level": 20,
        "bread": 7500000,
        "wood": 7500000,
        "stone": 1500000,
        "iron": 370000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 44430,
        "power": 0,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 21,
        "bread": 9500000,
        "wood": 9500000,
        "stone": 1900000,
        "iron": 470000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 57750,
        "power": 0,
        "requirements": {
          "town-center": 21
        }
      },
      {
        "level": 22,
        "bread": 12000000,
        "wood": 12000000,
        "stone": 2500000,
        "iron": 630000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 86640,
        "power": 0,
        "requirements": {
          "town-center": 22
        }
      },
      {
        "level": 23,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 780000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 121320,
        "power": 0,
        "requirements": {
          "town-center": 23
        }
      },
      {
        "level": 24,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169860,
        "power": 0,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 25,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 237780,
        "power": 0,
        "requirements": {
          "town-center": 25
        }
      },
      {
        "level": 26,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7300000,
        "iron": 1800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 273420,
        "power": 0,
        "requirements": {
          "town-center": 26
        }
      },
      {
        "level": 27,
        "bread": 52000000,
        "wood": 52000000,
        "stone": 10000000,
        "iron": 2600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 328140,
        "power": 0,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 28,
        "bread": 69000000,
        "wood": 69000000,
        "stone": 13000000,
        "iron": 3400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 377340,
        "power": 0,
        "requirements": {
          "town-center": 28
        }
      },
      {
        "level": 29,
        "bread": 86000000,
        "wood": 86000000,
        "stone": 17000000,
        "iron": 4300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 433980,
        "power": 0,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 30,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 520800,
        "power": 0,
        "requirements": {
          "town-center": 30
        }
      },
      {
        "level": 31,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 316180,
        "requirements": {}
      },
      {
        "level": 32,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 327660,
        "requirements": {}
      },
      {
        "level": 33,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 339140,
        "requirements": {}
      },
      {
        "level": 34,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 350620,
        "requirements": {}
      },
      {
        "level": 35,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 362100,
        "requirements": {}
      },
      {
        "level": 36,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 373580,
        "requirements": {}
      },
      {
        "level": 37,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 385060,
        "requirements": {}
      },
      {
        "level": 38,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 396540,
        "requirements": {}
      },
      {
        "level": 39,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 408020,
        "requirements": {}
      },
      {
        "level": 40,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 419500,
        "requirements": {}
      },
      {
        "level": 41,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 430980,
        "requirements": {}
      },
      {
        "level": 42,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 442460,
        "requirements": {}
      },
      {
        "level": 43,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 453940,
        "requirements": {}
      },
      {
        "level": 44,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 465420,
        "requirements": {}
      },
      {
        "level": 45,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 476900,
        "requirements": {}
      },
      {
        "level": 46,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 489540,
        "requirements": {}
      },
      {
        "level": 47,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 502180,
        "requirements": {}
      },
      {
        "level": 48,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 514820,
        "requirements": {}
      },
      {
        "level": 49,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 527460,
        "requirements": {}
      },
      {
        "level": 50,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 540100,
        "requirements": {}
      },
      {
        "level": 51,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 552740,
        "requirements": {}
      },
      {
        "level": 52,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 565380,
        "requirements": {}
      },
      {
        "level": 53,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 578020,
        "requirements": {}
      },
      {
        "level": 54,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 590660,
        "requirements": {}
      },
      {
        "level": 55,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 603300,
        "requirements": {}
      },
      {
        "level": 56,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 616820,
        "requirements": {}
      },
      {
        "level": 57,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 630340,
        "requirements": {}
      },
      {
        "level": 58,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 643860,
        "requirements": {}
      },
      {
        "level": 59,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 657380,
        "requirements": {}
      },
      {
        "level": 60,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 45,
        "temperedTruegold": 9,
        "seconds": 194400,
        "power": 670900,
        "requirements": {}
      },
      {
        "level": 61,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 684420,
        "requirements": {}
      },
      {
        "level": 62,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 697940,
        "requirements": {}
      },
      {
        "level": 63,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 711460,
        "requirements": {}
      },
      {
        "level": 64,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 724980,
        "requirements": {}
      },
      {
        "level": 65,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 54,
        "temperedTruegold": 13,
        "seconds": 233280,
        "power": 738500,
        "requirements": {}
      },
      {
        "level": 66,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 752020,
        "requirements": {}
      },
      {
        "level": 67,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 765540,
        "requirements": {}
      },
      {
        "level": 68,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 779060,
        "requirements": {}
      },
      {
        "level": 69,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 792580,
        "requirements": {}
      },
      {
        "level": 70,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 54,
        "temperedTruegold": 18,
        "seconds": 259200,
        "power": 806100,
        "requirements": {}
      }
    ]
  },
  {
    "id": "stable",
    "name": "기병대",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 0,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 140,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 645,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 45,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 1400,
        "stone": 285,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 125,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 6000,
        "stone": 1200,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 270,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 15000,
        "stone": 3000,
        "iron": 765,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 540,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 55000,
        "stone": 11000,
        "iron": 2700,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1080,
        "power": 0,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 100000,
        "stone": 20000,
        "iron": 5000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1620,
        "power": 0,
        "requirements": {
          "town-center": 8
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 200000,
        "stone": 41000,
        "iron": 10000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2430,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 360000,
        "stone": 73000,
        "iron": 18000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3240,
        "power": 0,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 11,
        "bread": 460000,
        "wood": 460000,
        "stone": 92000,
        "iron": 23000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4050,
        "power": 0,
        "requirements": {
          "town-center": 11
        }
      },
      {
        "level": 12,
        "bread": 580000,
        "wood": 580000,
        "stone": 110000,
        "iron": 29000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4860,
        "power": 0,
        "requirements": {
          "town-center": 12
        }
      },
      {
        "level": 13,
        "bread": 830000,
        "wood": 830000,
        "stone": 160000,
        "iron": 41000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 5940,
        "power": 0,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 14,
        "bread": 1100000,
        "wood": 1100000,
        "stone": 220000,
        "iron": 55000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7560,
        "power": 0,
        "requirements": {
          "town-center": 14
        }
      },
      {
        "level": 15,
        "bread": 1600000,
        "wood": 1600000,
        "stone": 320000,
        "iron": 81000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9720,
        "power": 0,
        "requirements": {
          "town-center": 15
        }
      },
      {
        "level": 16,
        "bread": 2000000,
        "wood": 2000000,
        "stone": 410000,
        "iron": 100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 16440,
        "power": 0,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 17,
        "bread": 3200000,
        "wood": 3200000,
        "stone": 650000,
        "iron": 160000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 19740,
        "power": 0,
        "requirements": {
          "town-center": 17
        }
      },
      {
        "level": 18,
        "bread": 4300000,
        "wood": 4300000,
        "stone": 870000,
        "iron": 210000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 23700,
        "power": 0,
        "requirements": {
          "town-center": 18
        }
      },
      {
        "level": 19,
        "bread": 5400000,
        "wood": 5400000,
        "stone": 1000000,
        "iron": 270000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35520,
        "power": 0,
        "requirements": {
          "town-center": 19
        }
      },
      {
        "level": 20,
        "bread": 7500000,
        "wood": 7500000,
        "stone": 1500000,
        "iron": 370000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 44430,
        "power": 0,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 21,
        "bread": 9500000,
        "wood": 9500000,
        "stone": 1900000,
        "iron": 470000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 57750,
        "power": 0,
        "requirements": {
          "town-center": 21
        }
      },
      {
        "level": 22,
        "bread": 12000000,
        "wood": 12000000,
        "stone": 2500000,
        "iron": 630000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 86640,
        "power": 0,
        "requirements": {
          "town-center": 22
        }
      },
      {
        "level": 23,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3100000,
        "iron": 780000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 121320,
        "power": 0,
        "requirements": {
          "town-center": 23
        }
      },
      {
        "level": 24,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169860,
        "power": 0,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 25,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 237780,
        "power": 0,
        "requirements": {
          "town-center": 25
        }
      },
      {
        "level": 26,
        "bread": 36000000,
        "wood": 36000000,
        "stone": 7300000,
        "iron": 1800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 273420,
        "power": 0,
        "requirements": {
          "town-center": 26
        }
      },
      {
        "level": 27,
        "bread": 52000000,
        "wood": 52000000,
        "stone": 10000000,
        "iron": 2600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 328140,
        "power": 0,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 28,
        "bread": 69000000,
        "wood": 69000000,
        "stone": 13000000,
        "iron": 3400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 377340,
        "power": 0,
        "requirements": {
          "town-center": 28
        }
      },
      {
        "level": 29,
        "bread": 86000000,
        "wood": 86000000,
        "stone": 17000000,
        "iron": 4300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 433980,
        "power": 0,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 30,
        "bread": 100000000,
        "wood": 100000000,
        "stone": 21000000,
        "iron": 5800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 520800,
        "power": 0,
        "requirements": {
          "town-center": 30
        }
      },
      {
        "level": 31,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 316180,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 32,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 327660,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 33,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 339140,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 34,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 350620,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 35,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 59,
        "temperedTruegold": 0,
        "seconds": 90720,
        "power": 362100,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 36,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 373580,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 37,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 385060,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 38,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 396540,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 39,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 408020,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 40,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 71,
        "temperedTruegold": 0,
        "seconds": 116640,
        "power": 419500,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 41,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 430980,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 42,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 442460,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 43,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 453940,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 44,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 465420,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 45,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5500000,
        "iron": 1300000,
        "truegold": 107,
        "temperedTruegold": 0,
        "seconds": 142560,
        "power": 476900,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 46,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 489540,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 47,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 502180,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 48,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 514820,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 49,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 527460,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 50,
        "bread": 28000000,
        "wood": 28000000,
        "stone": 5700000,
        "iron": 1400000,
        "truegold": 126,
        "temperedTruegold": 0,
        "seconds": 155520,
        "power": 540100,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 51,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 552740,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 52,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 565380,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 53,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 578020,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 54,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 590660,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 55,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5900000,
        "iron": 1400000,
        "truegold": 150,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 603300,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 56,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 616820,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 57,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 630340,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 58,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 643860,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 59,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 90,
        "temperedTruegold": 4,
        "seconds": 194400,
        "power": 657380,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 60,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6700000,
        "iron": 1600000,
        "truegold": 45,
        "temperedTruegold": 9,
        "seconds": 194400,
        "power": 670900,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 61,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 684420,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 62,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 697940,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 63,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 711460,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 64,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 108,
        "temperedTruegold": 6,
        "seconds": 233280,
        "power": 724980,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 65,
        "bread": 38000000,
        "wood": 38000000,
        "stone": 7600000,
        "iron": 1900000,
        "truegold": 54,
        "temperedTruegold": 13,
        "seconds": 233280,
        "power": 738500,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 66,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 752020,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 67,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 765540,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 68,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 779060,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 69,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 108,
        "temperedTruegold": 9,
        "seconds": 259200,
        "power": 792580,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 70,
        "bread": 46000000,
        "wood": 46000000,
        "stone": 9300000,
        "iron": 2300000,
        "truegold": 54,
        "temperedTruegold": 18,
        "seconds": 259200,
        "power": 806100,
        "requirements": {
          "town-center": 70
        }
      }
    ]
  },
  {
    "id": "commandcenter",
    "name": "지휘부",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 80,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 125,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 8,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 565,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 1200,
        "stone": 250,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 105,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 5300,
        "stone": 1000,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 215,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 13000,
        "stone": 2600,
        "iron": 670,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 430,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 48000,
        "stone": 9600,
        "iron": 2400,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 840,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 88000,
        "stone": 17000,
        "iron": 4400,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1290,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 180000,
        "stone": 36000,
        "iron": 9100,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1920,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 320000,
        "stone": 64000,
        "iron": 16000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2580,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 11,
        "bread": 390000,
        "wood": 390000,
        "stone": 79000,
        "iron": 19000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3240,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 12,
        "bread": 500000,
        "wood": 500000,
        "stone": 100000,
        "iron": 25000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3870,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 13,
        "bread": 710000,
        "wood": 710000,
        "stone": 140000,
        "iron": 35000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4740,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 14,
        "bread": 940000,
        "wood": 940000,
        "stone": 180000,
        "iron": 47000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 6030,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 15,
        "bread": 1300000,
        "wood": 1300000,
        "stone": 270000,
        "iron": 69000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7770,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 16,
        "bread": 1700000,
        "wood": 1700000,
        "stone": 350000,
        "iron": 89000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 13140,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 17,
        "bread": 2700000,
        "wood": 2700000,
        "stone": 550000,
        "iron": 130000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 15780,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 18,
        "bread": 3700000,
        "wood": 3700000,
        "stone": 750000,
        "iron": 180000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 18960,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 19,
        "bread": 4700000,
        "wood": 4700000,
        "stone": 940000,
        "iron": 230000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 28440,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 20,
        "bread": 6400000,
        "wood": 6400000,
        "stone": 1200000,
        "iron": 320000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35520,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 21,
        "bread": 8100000,
        "wood": 8100000,
        "stone": 1600000,
        "iron": 400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 46200,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 22,
        "bread": 10000000,
        "wood": 10000000,
        "stone": 2100000,
        "iron": 540000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 69330,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 23,
        "bread": 13000000,
        "wood": 13000000,
        "stone": 2600000,
        "iron": 670000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 97020,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 24,
        "bread": 18000000,
        "wood": 18000000,
        "stone": 3600000,
        "iron": 900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 135840,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 25,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4900000,
        "iron": 1200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 190200,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 26,
        "bread": 31000000,
        "wood": 31000000,
        "stone": 6300000,
        "iron": 1500000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 218760,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 27,
        "bread": 44000000,
        "wood": 44000000,
        "stone": 8900000,
        "iron": 2200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 262500,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 28,
        "bread": 59000000,
        "wood": 59000000,
        "stone": 11000000,
        "iron": 2900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 301860,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 29,
        "bread": 73000000,
        "wood": 73000000,
        "stone": 14000000,
        "iron": 3600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 347160,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 30,
        "bread": 90000000,
        "wood": 90000000,
        "stone": 18000000,
        "iron": 4500000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 416640,
        "power": 0,
        "requirements": {}
      },
      {
        "level": 31,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4000000,
        "iron": 1000000,
        "truegold": 26,
        "temperedTruegold": 0,
        "seconds": 72570,
        "power": 0,
        "requirements": {
          "town-center": 35,
          "embassy": 35
        }
      },
      {
        "level": 32,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4000000,
        "iron": 1000000,
        "truegold": 26,
        "temperedTruegold": 0,
        "seconds": 72570,
        "power": 0,
        "requirements": {
          "town-center": 35,
          "embassy": 35
        }
      },
      {
        "level": 33,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4000000,
        "iron": 1000000,
        "truegold": 26,
        "temperedTruegold": 0,
        "seconds": 72570,
        "power": 0,
        "requirements": {
          "town-center": 35,
          "embassy": 35
        }
      },
      {
        "level": 34,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4000000,
        "iron": 1000000,
        "truegold": 26,
        "temperedTruegold": 0,
        "seconds": 72570,
        "power": 0,
        "requirements": {
          "town-center": 35,
          "embassy": 35
        }
      },
      {
        "level": 35,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4000000,
        "iron": 1000000,
        "truegold": 26,
        "temperedTruegold": 0,
        "seconds": 72570,
        "power": 0,
        "requirements": {
          "town-center": 35,
          "embassy": 35
        }
      },
      {
        "level": 36,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 31,
        "temperedTruegold": 0,
        "seconds": 93300,
        "power": 0,
        "requirements": {
          "town-center": 40,
          "embassy": 40
        }
      },
      {
        "level": 37,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 31,
        "temperedTruegold": 0,
        "seconds": 93300,
        "power": 0,
        "requirements": {
          "town-center": 40,
          "embassy": 40
        }
      },
      {
        "level": 38,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 31,
        "temperedTruegold": 0,
        "seconds": 93300,
        "power": 0,
        "requirements": {
          "town-center": 40,
          "embassy": 40
        }
      },
      {
        "level": 39,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 31,
        "temperedTruegold": 0,
        "seconds": 93300,
        "power": 0,
        "requirements": {
          "town-center": 40,
          "embassy": 40
        }
      },
      {
        "level": 40,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4300000,
        "iron": 1000000,
        "truegold": 31,
        "temperedTruegold": 0,
        "seconds": 93300,
        "power": 0,
        "requirements": {
          "town-center": 40,
          "embassy": 40
        }
      },
      {
        "level": 41,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 47,
        "temperedTruegold": 0,
        "seconds": 114000,
        "power": 0,
        "requirements": {
          "town-center": 45,
          "embassy": 45
        }
      },
      {
        "level": 42,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 47,
        "temperedTruegold": 0,
        "seconds": 114000,
        "power": 0,
        "requirements": {
          "town-center": 45,
          "embassy": 45
        }
      },
      {
        "level": 43,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 47,
        "temperedTruegold": 0,
        "seconds": 114000,
        "power": 0,
        "requirements": {
          "town-center": 45,
          "embassy": 45
        }
      },
      {
        "level": 44,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 47,
        "temperedTruegold": 0,
        "seconds": 114000,
        "power": 0,
        "requirements": {
          "town-center": 45,
          "embassy": 45
        }
      },
      {
        "level": 45,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4700000,
        "iron": 1100000,
        "truegold": 47,
        "temperedTruegold": 0,
        "seconds": 114000,
        "power": 0,
        "requirements": {
          "town-center": 45,
          "embassy": 45
        }
      },
      {
        "level": 46,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4900000,
        "iron": 1200000,
        "truegold": 56,
        "temperedTruegold": 0,
        "seconds": 124380,
        "power": 0,
        "requirements": {
          "town-center": 50,
          "embassy": 50
        }
      },
      {
        "level": 47,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4900000,
        "iron": 1200000,
        "truegold": 56,
        "temperedTruegold": 0,
        "seconds": 124380,
        "power": 0,
        "requirements": {
          "town-center": 50,
          "embassy": 50
        }
      },
      {
        "level": 48,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4900000,
        "iron": 1200000,
        "truegold": 56,
        "temperedTruegold": 0,
        "seconds": 124380,
        "power": 0,
        "requirements": {
          "town-center": 50,
          "embassy": 50
        }
      },
      {
        "level": 49,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4900000,
        "iron": 1200000,
        "truegold": 56,
        "temperedTruegold": 0,
        "seconds": 124380,
        "power": 0,
        "requirements": {
          "town-center": 50,
          "embassy": 50
        }
      },
      {
        "level": 50,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4900000,
        "iron": 1200000,
        "truegold": 56,
        "temperedTruegold": 0,
        "seconds": 124380,
        "power": 0,
        "requirements": {
          "town-center": 50,
          "embassy": 50
        }
      },
      {
        "level": 51,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 67,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 55,
          "embassy": 55
        }
      },
      {
        "level": 52,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 67,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 55,
          "embassy": 55
        }
      },
      {
        "level": 53,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 67,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 55,
          "embassy": 55
        }
      },
      {
        "level": 54,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 67,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 55,
          "embassy": 55
        }
      },
      {
        "level": 55,
        "bread": 25000000,
        "wood": 25000000,
        "stone": 5000000,
        "iron": 1200000,
        "truegold": 67,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 55,
          "embassy": 55
        }
      },
      {
        "level": 56,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5800000,
        "iron": 1400000,
        "truegold": 40,
        "temperedTruegold": 2,
        "seconds": 155520,
        "power": 0,
        "requirements": {
          "town-center": 60,
          "embassy": 60
        }
      },
      {
        "level": 57,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5800000,
        "iron": 1400000,
        "truegold": 40,
        "temperedTruegold": 2,
        "seconds": 155520,
        "power": 0,
        "requirements": {
          "town-center": 60,
          "embassy": 60
        }
      },
      {
        "level": 58,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5800000,
        "iron": 1400000,
        "truegold": 40,
        "temperedTruegold": 2,
        "seconds": 155520,
        "power": 0,
        "requirements": {
          "town-center": 60,
          "embassy": 60
        }
      },
      {
        "level": 59,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5800000,
        "iron": 1400000,
        "truegold": 40,
        "temperedTruegold": 2,
        "seconds": 155520,
        "power": 0,
        "requirements": {
          "town-center": 60,
          "embassy": 60
        }
      },
      {
        "level": 60,
        "bread": 29000000,
        "wood": 29000000,
        "stone": 5800000,
        "iron": 1400000,
        "truegold": 20,
        "temperedTruegold": 5,
        "seconds": 155520,
        "power": 0,
        "requirements": {
          "town-center": 60,
          "embassy": 60
        }
      },
      {
        "level": 61,
        "bread": 32000000,
        "wood": 32000000,
        "stone": 6500000,
        "iron": 1600000,
        "truegold": 48,
        "temperedTruegold": 3,
        "seconds": 186600,
        "power": 0,
        "requirements": {
          "town-center": 65,
          "embassy": 65
        }
      },
      {
        "level": 62,
        "bread": 32000000,
        "wood": 32000000,
        "stone": 6500000,
        "iron": 1600000,
        "truegold": 48,
        "temperedTruegold": 3,
        "seconds": 186600,
        "power": 0,
        "requirements": {
          "town-center": 65,
          "embassy": 65
        }
      },
      {
        "level": 63,
        "bread": 32000000,
        "wood": 32000000,
        "stone": 6500000,
        "iron": 1600000,
        "truegold": 48,
        "temperedTruegold": 3,
        "seconds": 186600,
        "power": 0,
        "requirements": {
          "town-center": 65,
          "embassy": 65
        }
      },
      {
        "level": 64,
        "bread": 32000000,
        "wood": 32000000,
        "stone": 6500000,
        "iron": 1600000,
        "truegold": 48,
        "temperedTruegold": 3,
        "seconds": 186600,
        "power": 0,
        "requirements": {
          "town-center": 65,
          "embassy": 65
        }
      },
      {
        "level": 65,
        "bread": 32000000,
        "wood": 32000000,
        "stone": 6500000,
        "iron": 1600000,
        "truegold": 24,
        "temperedTruegold": 7,
        "seconds": 186600,
        "power": 0,
        "requirements": {
          "town-center": 65,
          "embassy": 65
        }
      },
      {
        "level": 66,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 48,
        "temperedTruegold": 4,
        "seconds": 207360,
        "power": 0,
        "requirements": {
          "town-center": 70,
          "embassy": 70
        }
      },
      {
        "level": 67,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 48,
        "temperedTruegold": 4,
        "seconds": 207360,
        "power": 0,
        "requirements": {
          "town-center": 70,
          "embassy": 70
        }
      },
      {
        "level": 68,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 48,
        "temperedTruegold": 4,
        "seconds": 207360,
        "power": 0,
        "requirements": {
          "town-center": 70,
          "embassy": 70
        }
      },
      {
        "level": 69,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 48,
        "temperedTruegold": 4,
        "seconds": 207360,
        "power": 0,
        "requirements": {
          "town-center": 70,
          "embassy": 70
        }
      },
      {
        "level": 70,
        "bread": 39000000,
        "wood": 39000000,
        "stone": 7900000,
        "iron": 1900000,
        "truegold": 24,
        "temperedTruegold": 8,
        "seconds": 207360,
        "power": 0,
        "requirements": {
          "town-center": 70,
          "embassy": 70
        }
      }
    ]
  },
  {
    "id": "storehouse",
    "name": "창고",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 60,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 90,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 400,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 45,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 900,
        "stone": 180,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 135,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 3800,
        "stone": 760,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 270,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 9600,
        "stone": 1900,
        "iron": 480,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 540,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 34000,
        "stone": 6900,
        "iron": 1700,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1080,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 63000,
        "stone": 12000,
        "iron": 3100,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1620,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 130000,
        "stone": 26000,
        "iron": 6500,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2430,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 230000,
        "stone": 46000,
        "iron": 11000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3240,
        "power": 0,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 11,
        "bread": 290000,
        "wood": 290000,
        "stone": 57000,
        "iron": 14000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4050,
        "power": 0,
        "requirements": {
          "town-center": 11
        }
      },
      {
        "level": 12,
        "bread": 370000,
        "wood": 370000,
        "stone": 74000,
        "iron": 18000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4860,
        "power": 0,
        "requirements": {
          "town-center": 12
        }
      },
      {
        "level": 13,
        "bread": 520000,
        "wood": 520000,
        "stone": 100000,
        "iron": 26000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 5940,
        "power": 0,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 14,
        "bread": 690000,
        "wood": 690000,
        "stone": 130000,
        "iron": 34000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7560,
        "power": 0,
        "requirements": {
          "town-center": 14
        }
      },
      {
        "level": 15,
        "bread": 1000000,
        "wood": 1000000,
        "stone": 200000,
        "iron": 51000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9720,
        "power": 0,
        "requirements": {
          "town-center": 15
        }
      },
      {
        "level": 16,
        "bread": 1300000,
        "wood": 1300000,
        "stone": 260000,
        "iron": 65000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 16440,
        "power": 0,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 17,
        "bread": 2000000,
        "wood": 2000000,
        "stone": 400000,
        "iron": 100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 19740,
        "power": 0,
        "requirements": {
          "town-center": 17
        }
      },
      {
        "level": 18,
        "bread": 2700000,
        "wood": 2700000,
        "stone": 550000,
        "iron": 130000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 23700,
        "power": 0,
        "requirements": {
          "town-center": 18
        }
      },
      {
        "level": 19,
        "bread": 3400000,
        "wood": 3400000,
        "stone": 690000,
        "iron": 170000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35550,
        "power": 0,
        "requirements": {
          "town-center": 19
        }
      },
      {
        "level": 20,
        "bread": 4700000,
        "wood": 4700000,
        "stone": 940000,
        "iron": 230000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 44430,
        "power": 0,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 21,
        "bread": 6000000,
        "wood": 6000000,
        "stone": 1200000,
        "iron": 300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 57750,
        "power": 0,
        "requirements": {
          "town-center": 21
        }
      },
      {
        "level": 22,
        "bread": 7900000,
        "wood": 7900000,
        "stone": 1500000,
        "iron": 390000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 86640,
        "power": 0,
        "requirements": {
          "town-center": 22
        }
      },
      {
        "level": 23,
        "bread": 9800000,
        "wood": 9800000,
        "stone": 1900000,
        "iron": 490000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 121320,
        "power": 0,
        "requirements": {
          "town-center": 23
        }
      },
      {
        "level": 24,
        "bread": 13000000,
        "wood": 13000000,
        "stone": 2600000,
        "iron": 660000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169860,
        "power": 0,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 25,
        "bread": 17000000,
        "wood": 17000000,
        "stone": 3500000,
        "iron": 890000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 237780,
        "power": 0,
        "requirements": {
          "town-center": 25
        }
      },
      {
        "level": 26,
        "bread": 23000000,
        "wood": 23000000,
        "stone": 4600000,
        "iron": 1100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 273420,
        "power": 0,
        "requirements": {
          "town-center": 26
        }
      },
      {
        "level": 27,
        "bread": 32000000,
        "wood": 32000000,
        "stone": 6500000,
        "iron": 1600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 328140,
        "power": 0,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 28,
        "bread": 43000000,
        "wood": 43000000,
        "stone": 8700000,
        "iron": 2100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 377340,
        "power": 0,
        "requirements": {
          "town-center": 28
        }
      },
      {
        "level": 29,
        "bread": 54000000,
        "wood": 54000000,
        "stone": 10000000,
        "iron": 2700000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 433980,
        "power": 0,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 30,
        "bread": 66000000,
        "wood": 66000000,
        "stone": 13000000,
        "iron": 3300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 520800,
        "power": 0,
        "requirements": {
          "town-center": 30
        }
      }
    ]
  },
  {
    "id": "kitchen",
    "name": "주방",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 35,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2,
        "power": 100,
        "requirements": {}
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 50,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9,
        "power": 190,
        "requirements": {}
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 240,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 45,
        "power": 325,
        "requirements": {}
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 540,
        "stone": 105,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 135,
        "power": 505,
        "requirements": {}
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 2200,
        "stone": 455,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 270,
        "power": 775,
        "requirements": {}
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 5700,
        "stone": 1100,
        "iron": 285,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 540,
        "power": 1180,
        "requirements": {}
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 20000,
        "stone": 4100,
        "iron": 1000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1080,
        "power": 1765,
        "requirements": {}
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 37000,
        "stone": 7500,
        "iron": 1800,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1620,
        "power": 2350,
        "requirements": {}
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 78000,
        "stone": 15000,
        "iron": 3900,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2430,
        "power": 2935,
        "requirements": {}
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 130000,
        "stone": 27000,
        "iron": 6900,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3240,
        "power": 3785,
        "requirements": {}
      }
    ]
  },
  {
    "id": "infirmary",
    "name": "야전병원",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 0,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 0,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 100,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 0,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 460,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 0,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 4,
        "bread": 0,
        "wood": 1000,
        "stone": 205,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 120,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 5,
        "bread": 0,
        "wood": 4300,
        "stone": 865,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 240,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 6,
        "bread": 0,
        "wood": 10000,
        "stone": 2100,
        "iron": 545,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 480,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 7,
        "bread": 0,
        "wood": 39000,
        "stone": 7800,
        "iron": 1900,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 960,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 8,
        "bread": 0,
        "wood": 72000,
        "stone": 14000,
        "iron": 3600,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1500,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 9,
        "bread": 0,
        "wood": 140000,
        "stone": 29000,
        "iron": 7400,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 2220,
        "power": 0,
        "requirements": {
          "town-center": 9
        }
      },
      {
        "level": 10,
        "bread": 0,
        "wood": 260000,
        "stone": 52000,
        "iron": 13000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3000,
        "power": 0,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 11,
        "bread": 320000,
        "wood": 320000,
        "stone": 65000,
        "iron": 16000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3780,
        "power": 0,
        "requirements": {
          "town-center": 11
        }
      },
      {
        "level": 12,
        "bread": 420000,
        "wood": 420000,
        "stone": 84000,
        "iron": 21000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 4500,
        "power": 0,
        "requirements": {
          "town-center": 12
        }
      },
      {
        "level": 13,
        "bread": 590000,
        "wood": 590000,
        "stone": 110000,
        "iron": 29000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 5520,
        "power": 0,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 14,
        "bread": 780000,
        "wood": 780000,
        "stone": 150000,
        "iron": 39000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 7020,
        "power": 0,
        "requirements": {
          "town-center": 14
        }
      },
      {
        "level": 15,
        "bread": 1100000,
        "wood": 1100000,
        "stone": 230000,
        "iron": 58000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 9060,
        "power": 0,
        "requirements": {
          "town-center": 15
        }
      },
      {
        "level": 16,
        "bread": 1400000,
        "wood": 1400000,
        "stone": 290000,
        "iron": 74000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 15360,
        "power": 0,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 17,
        "bread": 2300000,
        "wood": 2300000,
        "stone": 460000,
        "iron": 100000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 18420,
        "power": 0,
        "requirements": {
          "town-center": 17
        }
      },
      {
        "level": 18,
        "bread": 3100000,
        "wood": 3100000,
        "stone": 620000,
        "iron": 150000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 22080,
        "power": 0,
        "requirements": {
          "town-center": 18
        }
      },
      {
        "level": 19,
        "bread": 3900000,
        "wood": 3900000,
        "stone": 780000,
        "iron": 190000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 33180,
        "power": 0,
        "requirements": {
          "town-center": 19
        }
      },
      {
        "level": 20,
        "bread": 5300000,
        "wood": 5300000,
        "stone": 1000000,
        "iron": 260000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 41460,
        "power": 0,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 21,
        "bread": 6800000,
        "wood": 6800000,
        "stone": 1300000,
        "iron": 340000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 53880,
        "power": 0,
        "requirements": {
          "town-center": 21
        }
      },
      {
        "level": 22,
        "bread": 9000000,
        "wood": 9000000,
        "stone": 1800000,
        "iron": 450000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 80880,
        "power": 0,
        "requirements": {
          "town-center": 22
        }
      },
      {
        "level": 23,
        "bread": 11000000,
        "wood": 11000000,
        "stone": 2200000,
        "iron": 560000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 113220,
        "power": 0,
        "requirements": {
          "town-center": 23
        }
      },
      {
        "level": 24,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3000000,
        "iron": 750000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 158520,
        "power": 0,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 25,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4000000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 221940,
        "power": 0,
        "requirements": {
          "town-center": 25
        }
      },
      {
        "level": 26,
        "bread": 26000000,
        "wood": 26000000,
        "stone": 5200000,
        "iron": 1300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 255240,
        "power": 0,
        "requirements": {
          "town-center": 26
        }
      },
      {
        "level": 27,
        "bread": 37000000,
        "wood": 37000000,
        "stone": 7400000,
        "iron": 1800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 306240,
        "power": 0,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 28,
        "bread": 49000000,
        "wood": 49000000,
        "stone": 9900000,
        "iron": 2400000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 352200,
        "power": 0,
        "requirements": {
          "town-center": 28
        }
      },
      {
        "level": 29,
        "bread": 61000000,
        "wood": 61000000,
        "stone": 12000000,
        "iron": 3000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 405060,
        "power": 0,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 30,
        "bread": 75000000,
        "wood": 75000000,
        "stone": 15000000,
        "iron": 3700000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 486060,
        "power": 0,
        "requirements": {
          "town-center": 30
        }
      },
      {
        "level": 31,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 84660,
        "power": 0,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 32,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 84660,
        "power": 0,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 33,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 84660,
        "power": 0,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 34,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 84660,
        "power": 0,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 35,
        "bread": 16000000,
        "wood": 16000000,
        "stone": 3300000,
        "iron": 840000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 84660,
        "power": 0,
        "requirements": {
          "town-center": 35
        }
      },
      {
        "level": 36,
        "bread": 18000000,
        "wood": 18000000,
        "stone": 3600000,
        "iron": 900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 108840,
        "power": 0,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 37,
        "bread": 18000000,
        "wood": 18000000,
        "stone": 3600000,
        "iron": 900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 108840,
        "power": 0,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 38,
        "bread": 18000000,
        "wood": 18000000,
        "stone": 3600000,
        "iron": 900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 108840,
        "power": 0,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 39,
        "bread": 18000000,
        "wood": 18000000,
        "stone": 3600000,
        "iron": 900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 108840,
        "power": 0,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 40,
        "bread": 18000000,
        "wood": 18000000,
        "stone": 3600000,
        "iron": 900000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 108840,
        "power": 0,
        "requirements": {
          "town-center": 40
        }
      },
      {
        "level": 41,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3900000,
        "iron": 990000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 133020,
        "power": 0,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 42,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3900000,
        "iron": 990000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 133020,
        "power": 0,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 43,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3900000,
        "iron": 990000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 133020,
        "power": 0,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 44,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3900000,
        "iron": 990000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 133020,
        "power": 0,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 45,
        "bread": 19000000,
        "wood": 19000000,
        "stone": 3900000,
        "iron": 990000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 133020,
        "power": 0,
        "requirements": {
          "town-center": 45
        }
      },
      {
        "level": 46,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4100000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 47,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4100000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 48,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4100000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 49,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4100000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 50,
        "bread": 20000000,
        "wood": 20000000,
        "stone": 4100000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 145140,
        "power": 0,
        "requirements": {
          "town-center": 50
        }
      },
      {
        "level": 51,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169320,
        "power": 0,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 52,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169320,
        "power": 0,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 53,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169320,
        "power": 0,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 54,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169320,
        "power": 0,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 55,
        "bread": 21000000,
        "wood": 21000000,
        "stone": 4200000,
        "iron": 1000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 169320,
        "power": 0,
        "requirements": {
          "town-center": 55
        }
      },
      {
        "level": 56,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4800000,
        "iron": 1200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 0,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 57,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4800000,
        "iron": 1200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 0,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 58,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4800000,
        "iron": 1200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 0,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 59,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4800000,
        "iron": 1200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 0,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 60,
        "bread": 24000000,
        "wood": 24000000,
        "stone": 4800000,
        "iron": 1200000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 181440,
        "power": 0,
        "requirements": {
          "town-center": 60
        }
      },
      {
        "level": 61,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5400000,
        "iron": 1300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 217680,
        "power": 0,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 62,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5400000,
        "iron": 1300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 217680,
        "power": 0,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 63,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5400000,
        "iron": 1300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 217680,
        "power": 0,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 64,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5400000,
        "iron": 1300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 217680,
        "power": 0,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 65,
        "bread": 27000000,
        "wood": 27000000,
        "stone": 5400000,
        "iron": 1300000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 217680,
        "power": 0,
        "requirements": {
          "town-center": 65
        }
      },
      {
        "level": 66,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6600000,
        "iron": 1600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 0,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 67,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6600000,
        "iron": 1600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 0,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 68,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6600000,
        "iron": 1600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 0,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 69,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6600000,
        "iron": 1600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 0,
        "requirements": {
          "town-center": 70
        }
      },
      {
        "level": 70,
        "bread": 33000000,
        "wood": 33000000,
        "stone": 6600000,
        "iron": 1600000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 241920,
        "power": 0,
        "requirements": {
          "town-center": 70
        }
      }
    ]
  },
  {
    "id": "guard-station",
    "name": "방위소",
    "steps": [
      {
        "level": 1,
        "bread": 0,
        "wood": 0,
        "stone": 0,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 0,
        "power": 400,
        "requirements": {}
      },
      {
        "level": 2,
        "bread": 0,
        "wood": 5300,
        "stone": 1000,
        "iron": 0,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 10,
        "power": 3100,
        "requirements": {
          "town-center": 7
        }
      },
      {
        "level": 3,
        "bread": 0,
        "wood": 88000,
        "stone": 17000,
        "iron": 4400,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 1290,
        "power": 9400,
        "requirements": {
          "town-center": 10
        }
      },
      {
        "level": 4,
        "bread": 420000,
        "wood": 420000,
        "stone": 84000,
        "iron": 21000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 3870,
        "power": 21940,
        "requirements": {
          "town-center": 13
        }
      },
      {
        "level": 5,
        "bread": 1400000,
        "wood": 1400000,
        "stone": 290000,
        "iron": 74000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 13140,
        "power": 47240,
        "requirements": {
          "town-center": 16
        }
      },
      {
        "level": 6,
        "bread": 5300000,
        "wood": 5300000,
        "stone": 1000000,
        "iron": 260000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 35550,
        "power": 86360,
        "requirements": {
          "town-center": 20
        }
      },
      {
        "level": 7,
        "bread": 15000000,
        "wood": 15000000,
        "stone": 3000000,
        "iron": 750000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 135840,
        "power": 149500,
        "requirements": {
          "town-center": 24
        }
      },
      {
        "level": 8,
        "bread": 37000000,
        "wood": 37000000,
        "stone": 7400000,
        "iron": 1800000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 262500,
        "power": 217320,
        "requirements": {
          "town-center": 27
        }
      },
      {
        "level": 9,
        "bread": 61000000,
        "wood": 61000000,
        "stone": 12000000,
        "iron": 3000000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 347160,
        "power": 267920,
        "requirements": {
          "town-center": 29
        }
      },
      {
        "level": 10,
        "bread": 75000000,
        "wood": 75000000,
        "stone": 15000000,
        "iron": 3700000,
        "truegold": 0,
        "temperedTruegold": 0,
        "seconds": 416640,
        "power": 304700,
        "requirements": {
          "town-center": 30
        }
      }
    ]
  }
];
