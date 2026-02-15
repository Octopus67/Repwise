"""Global food database with USDA-sourced nutrition data."""
from __future__ import annotations

GLOBAL_FOOD_ITEMS: list[dict] = [
  {
    "name": "Apple",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 182,
    "serving_unit": "g",
    "calories": 95,
    "protein_g": 0.5,
    "carbs_g": 25.1,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 4.4,
      "vitamin_c_mg": 8.4,
      "potassium_mg": 195,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 182,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Banana",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 118,
    "serving_unit": "g",
    "calories": 105,
    "protein_g": 1.3,
    "carbs_g": 27.0,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.1,
      "potassium_mg": 422,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 118,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Orange",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 131,
    "serving_unit": "g",
    "calories": 62,
    "protein_g": 1.2,
    "carbs_g": 15.4,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 69.7,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 131,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Mango",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 165,
    "serving_unit": "g",
    "calories": 99,
    "protein_g": 1.4,
    "carbs_g": 24.7,
    "fat_g": 0.6,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 60.1,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 165,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Grapes",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 151,
    "serving_unit": "g",
    "calories": 104,
    "protein_g": 1.1,
    "carbs_g": 27.3,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 151,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Strawberries",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 152,
    "serving_unit": "g",
    "calories": 49,
    "protein_g": 1.0,
    "carbs_g": 11.7,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 89.4,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 152,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Blueberries",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 148,
    "serving_unit": "g",
    "calories": 84,
    "protein_g": 1.1,
    "carbs_g": 21.4,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.6,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 148,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Watermelon",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 286,
    "serving_unit": "g",
    "calories": 86,
    "protein_g": 1.7,
    "carbs_g": 21.6,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "2 cups",
          "grams": 286,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pineapple",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 165,
    "serving_unit": "g",
    "calories": 82,
    "protein_g": 0.9,
    "carbs_g": 21.6,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 78.9,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 165,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Papaya",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 145,
    "serving_unit": "g",
    "calories": 62,
    "protein_g": 0.7,
    "carbs_g": 15.7,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 88.3,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 145,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Kiwi",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 69,
    "serving_unit": "g",
    "calories": 42,
    "protein_g": 0.8,
    "carbs_g": 10.1,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 64.0,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 69,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Peach",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 150,
    "serving_unit": "g",
    "calories": 59,
    "protein_g": 1.4,
    "carbs_g": 14.3,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 150,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pear",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 178,
    "serving_unit": "g",
    "calories": 101,
    "protein_g": 0.6,
    "carbs_g": 27.1,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 5.5,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 178,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Avocado",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 68,
    "serving_unit": "g",
    "calories": 114,
    "protein_g": 1.3,
    "carbs_g": 6.0,
    "fat_g": 10.5,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 4.6,
      "potassium_mg": 345,
      "_serving_options": [
        {
          "label": "1/2",
          "grams": 68,
          "is_default": True
        },
        {
          "label": "1 whole",
          "grams": 136
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pomegranate",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 174,
    "serving_unit": "g",
    "calories": 144,
    "protein_g": 2.9,
    "carbs_g": 32.5,
    "fat_g": 2.0,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 7.0,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 174,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Guava",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 55,
    "serving_unit": "g",
    "calories": 37,
    "protein_g": 1.4,
    "carbs_g": 7.9,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 125.6,
      "_serving_options": [
        {
          "label": "1 fruit",
          "grams": 55,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cherries",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 138,
    "serving_unit": "g",
    "calories": 87,
    "protein_g": 1.5,
    "carbs_g": 22.1,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 138,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Grapefruit",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 123,
    "serving_unit": "g",
    "calories": 52,
    "protein_g": 0.9,
    "carbs_g": 13.1,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 38.4,
      "_serving_options": [
        {
          "label": "1/2",
          "grams": 123,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Raspberries",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 123,
    "serving_unit": "g",
    "calories": 64,
    "protein_g": 1.5,
    "carbs_g": 14.7,
    "fat_g": 0.8,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 8.0,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 123,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cantaloupe",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 177,
    "serving_unit": "g",
    "calories": 60,
    "protein_g": 1.5,
    "carbs_g": 14.4,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_a_mcg": 299,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 177,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Dates",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 24,
    "serving_unit": "g",
    "calories": 66,
    "protein_g": 0.4,
    "carbs_g": 18.0,
    "fat_g": 0.0,
    "source": "usda",
    "micro_nutrients": {
      "potassium_mg": 167,
      "_serving_options": [
        {
          "label": "1 date",
          "grams": 24,
          "is_default": True
        },
        {
          "label": "3 dates",
          "grams": 72
        }
      ]
    }
  },
  {
    "name": "Coconut",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 80,
    "serving_unit": "g",
    "calories": 283,
    "protein_g": 2.7,
    "carbs_g": 12.2,
    "fat_g": 26.8,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 7.2,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 80,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Blackberries",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 144,
    "serving_unit": "g",
    "calories": 62,
    "protein_g": 2.0,
    "carbs_g": 13.8,
    "fat_g": 0.7,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 7.6,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 144,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Plum",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 66,
    "serving_unit": "g",
    "calories": 30,
    "protein_g": 0.5,
    "carbs_g": 7.5,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 66,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Dragon Fruit",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 100,
    "serving_unit": "g",
    "calories": 60,
    "protein_g": 1.2,
    "carbs_g": 13.0,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.0,
      "_serving_options": [
        {
          "label": "100g",
          "grams": 100,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Tangerine",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 88,
    "serving_unit": "g",
    "calories": 47,
    "protein_g": 0.7,
    "carbs_g": 11.7,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 23.5,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 88,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Lemon",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 58,
    "serving_unit": "g",
    "calories": 17,
    "protein_g": 0.6,
    "carbs_g": 5.4,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 30.7,
      "_serving_options": [
        {
          "label": "1 fruit",
          "grams": 58,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Cranberries",
    "category": "Fruit",
    "region": "Global",
    "serving_size": 100,
    "serving_unit": "g",
    "calories": 46,
    "protein_g": 0.5,
    "carbs_g": 12.2,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 4.6,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 100,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Broccoli",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 91,
    "serving_unit": "g",
    "calories": 31,
    "protein_g": 2.6,
    "carbs_g": 6.0,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 2.4,
      "vitamin_c_mg": 81.2,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 91,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Spinach (raw)",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 30,
    "serving_unit": "g",
    "calories": 7,
    "protein_g": 0.9,
    "carbs_g": 1.1,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_a_mcg": 141,
      "iron_mg": 0.8,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 30,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Kale",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 67,
    "serving_unit": "g",
    "calories": 33,
    "protein_g": 2.2,
    "carbs_g": 6.7,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 80.4,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 67,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Carrot",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 61,
    "serving_unit": "g",
    "calories": 25,
    "protein_g": 0.6,
    "carbs_g": 5.8,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_a_mcg": 509,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 61,
          "is_default": True
        },
        {
          "label": "1 cup",
          "grams": 128
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Tomato",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 123,
    "serving_unit": "g",
    "calories": 22,
    "protein_g": 1.1,
    "carbs_g": 4.8,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 16.9,
      "potassium_mg": 292,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 123,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cucumber",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 301,
    "serving_unit": "g",
    "calories": 45,
    "protein_g": 2.0,
    "carbs_g": 11.0,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 whole",
          "grams": 301,
          "is_default": True
        },
        {
          "label": "1 cup",
          "grams": 119
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Bell Pepper (Red)",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 119,
    "serving_unit": "g",
    "calories": 37,
    "protein_g": 1.2,
    "carbs_g": 7.2,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 152.0,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 119,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Onion",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 110,
    "serving_unit": "g",
    "calories": 44,
    "protein_g": 1.2,
    "carbs_g": 10.3,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 110,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Potato (baked)",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 173,
    "serving_unit": "g",
    "calories": 161,
    "protein_g": 4.3,
    "carbs_g": 36.6,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "potassium_mg": 926,
      "fibre_g": 3.8,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 173,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Sweet Potato",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 114,
    "serving_unit": "g",
    "calories": 103,
    "protein_g": 2.3,
    "carbs_g": 23.6,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_a_mcg": 1096,
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 114,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cauliflower",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 107,
    "serving_unit": "g",
    "calories": 27,
    "protein_g": 2.1,
    "carbs_g": 5.3,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 51.6,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 107,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Zucchini",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 113,
    "serving_unit": "g",
    "calories": 19,
    "protein_g": 1.4,
    "carbs_g": 3.5,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 113,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Mushroom (White)",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 70,
    "serving_unit": "g",
    "calories": 15,
    "protein_g": 2.2,
    "carbs_g": 2.3,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "selenium_mcg": 6.5,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 70,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Lettuce (Romaine)",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 47,
    "serving_unit": "g",
    "calories": 8,
    "protein_g": 0.6,
    "carbs_g": 1.5,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_a_mcg": 205,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 47,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cabbage",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 89,
    "serving_unit": "g",
    "calories": 22,
    "protein_g": 1.1,
    "carbs_g": 5.2,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 32.6,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 89,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Celery",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 101,
    "serving_unit": "g",
    "calories": 16,
    "protein_g": 0.7,
    "carbs_g": 3.0,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "potassium_mg": 263,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 101,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Asparagus",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 134,
    "serving_unit": "g",
    "calories": 27,
    "protein_g": 2.9,
    "carbs_g": 5.2,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "folate_mcg": 70,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 134,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Green Beans",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 125,
    "serving_unit": "g",
    "calories": 34,
    "protein_g": 2.0,
    "carbs_g": 7.8,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.4,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 125,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Peas",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 145,
    "serving_unit": "g",
    "calories": 117,
    "protein_g": 7.9,
    "carbs_g": 21.0,
    "fat_g": 0.6,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 8.8,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 145,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Corn",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 154,
    "serving_unit": "g",
    "calories": 132,
    "protein_g": 5.1,
    "carbs_g": 29.3,
    "fat_g": 1.8,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.6,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 154,
          "is_default": True
        },
        {
          "label": "1 ear",
          "grams": 90
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Beetroot",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 136,
    "serving_unit": "g",
    "calories": 58,
    "protein_g": 2.2,
    "carbs_g": 13.0,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "folate_mcg": 148,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 136,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pumpkin",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 116,
    "serving_unit": "g",
    "calories": 30,
    "protein_g": 1.2,
    "carbs_g": 7.5,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_a_mcg": 245,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 116,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Brussels Sprouts",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 88,
    "serving_unit": "g",
    "calories": 38,
    "protein_g": 3.0,
    "carbs_g": 7.9,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 74.8,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 88,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Edamame",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 155,
    "serving_unit": "g",
    "calories": 188,
    "protein_g": 18.5,
    "carbs_g": 13.8,
    "fat_g": 8.1,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 8.1,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 155,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Eggplant",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 82,
    "serving_unit": "g",
    "calories": 20,
    "protein_g": 0.8,
    "carbs_g": 4.8,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 2.5,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 82,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Garlic",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 3,
    "serving_unit": "g",
    "calories": 4,
    "protein_g": 0.2,
    "carbs_g": 1.0,
    "fat_g": 0.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 clove",
          "grams": 3,
          "is_default": True
        },
        {
          "label": "3 cloves",
          "grams": 9
        }
      ]
    }
  },
  {
    "name": "Okra",
    "category": "Vegetable",
    "region": "Global",
    "serving_size": 100,
    "serving_unit": "g",
    "calories": 33,
    "protein_g": 1.9,
    "carbs_g": 7.5,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.2,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 100,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Chicken Breast",
    "category": "Protein",
    "region": "Global",
    "serving_size": 140,
    "serving_unit": "g",
    "calories": 231,
    "protein_g": 43.4,
    "carbs_g": 0.0,
    "fat_g": 5.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 breast",
          "grams": 140,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Chicken Thigh",
    "category": "Protein",
    "region": "Global",
    "serving_size": 116,
    "serving_unit": "g",
    "calories": 229,
    "protein_g": 28.3,
    "carbs_g": 0.0,
    "fat_g": 12.1,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 thigh",
          "grams": 116,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Turkey Breast",
    "category": "Protein",
    "region": "Global",
    "serving_size": 140,
    "serving_unit": "g",
    "calories": 189,
    "protein_g": 40.6,
    "carbs_g": 0.0,
    "fat_g": 2.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 serving",
          "grams": 140,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Ground Beef (lean)",
    "category": "Protein",
    "region": "Global",
    "serving_size": 112,
    "serving_unit": "g",
    "calories": 196,
    "protein_g": 28.6,
    "carbs_g": 0.0,
    "fat_g": 8.4,
    "source": "usda",
    "micro_nutrients": {
      "zinc_mg": 5.7,
      "iron_mg": 2.7,
      "_serving_options": [
        {
          "label": "4 oz",
          "grams": 112,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Ground Beef (regular)",
    "category": "Protein",
    "region": "Global",
    "serving_size": 112,
    "serving_unit": "g",
    "calories": 287,
    "protein_g": 25.6,
    "carbs_g": 0.0,
    "fat_g": 19.6,
    "source": "usda",
    "micro_nutrients": {
      "iron_mg": 2.5,
      "_serving_options": [
        {
          "label": "4 oz",
          "grams": 112,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Beef Sirloin",
    "category": "Protein",
    "region": "Global",
    "serving_size": 85,
    "serving_unit": "g",
    "calories": 177,
    "protein_g": 26.1,
    "carbs_g": 0.0,
    "fat_g": 7.6,
    "source": "usda",
    "micro_nutrients": {
      "zinc_mg": 4.5,
      "iron_mg": 1.6,
      "_serving_options": [
        {
          "label": "3 oz",
          "grams": 85,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pork Tenderloin",
    "category": "Protein",
    "region": "Global",
    "serving_size": 85,
    "serving_unit": "g",
    "calories": 120,
    "protein_g": 22.2,
    "carbs_g": 0.0,
    "fat_g": 3.0,
    "source": "usda",
    "micro_nutrients": {
      "thiamin_mg": 0.8,
      "_serving_options": [
        {
          "label": "3 oz",
          "grams": 85,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Bacon",
    "category": "Protein",
    "region": "Global",
    "serving_size": 8,
    "serving_unit": "g",
    "calories": 43,
    "protein_g": 3.0,
    "carbs_g": 0.1,
    "fat_g": 3.3,
    "source": "usda",
    "micro_nutrients": {
      "sodium_mg": 137,
      "_serving_options": [
        {
          "label": "1 slice",
          "grams": 8,
          "is_default": True
        },
        {
          "label": "3 slices",
          "grams": 24
        }
      ]
    }
  },
  {
    "name": "Salmon",
    "category": "Protein",
    "region": "Global",
    "serving_size": 85,
    "serving_unit": "g",
    "calories": 175,
    "protein_g": 18.8,
    "carbs_g": 0.0,
    "fat_g": 10.5,
    "source": "usda",
    "micro_nutrients": {
      "omega_3_g": 1.8,
      "vitamin_d_mcg": 11.1,
      "_serving_options": [
        {
          "label": "3 oz",
          "grams": 85,
          "is_default": True
        },
        {
          "label": "6 oz",
          "grams": 170
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Tuna (canned)",
    "category": "Protein",
    "region": "Global",
    "serving_size": 85,
    "serving_unit": "g",
    "calories": 73,
    "protein_g": 16.5,
    "carbs_g": 0.0,
    "fat_g": 0.6,
    "source": "usda",
    "micro_nutrients": {
      "selenium_mcg": 56.0,
      "_serving_options": [
        {
          "label": "3 oz",
          "grams": 85,
          "is_default": True
        },
        {
          "label": "1 can",
          "grams": 142
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Shrimp",
    "category": "Protein",
    "region": "Global",
    "serving_size": 85,
    "serving_unit": "g",
    "calories": 84,
    "protein_g": 20.4,
    "carbs_g": 0.0,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "3 oz",
          "grams": 85,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cod",
    "category": "Protein",
    "region": "Global",
    "serving_size": 85,
    "serving_unit": "g",
    "calories": 70,
    "protein_g": 15.1,
    "carbs_g": 0.0,
    "fat_g": 0.6,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "3 oz",
          "grams": 85,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Tilapia",
    "category": "Protein",
    "region": "Global",
    "serving_size": 87,
    "serving_unit": "g",
    "calories": 109,
    "protein_g": 22.8,
    "carbs_g": 0.0,
    "fat_g": 2.3,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 fillet",
          "grams": 87,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Sardines",
    "category": "Protein",
    "region": "Global",
    "serving_size": 92,
    "serving_unit": "g",
    "calories": 208,
    "protein_g": 24.6,
    "carbs_g": 0.0,
    "fat_g": 11.4,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 351,
      "omega_3_g": 1.4,
      "_serving_options": [
        {
          "label": "1 can",
          "grams": 92,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Eggs",
    "category": "Protein",
    "region": "Global",
    "serving_size": 50,
    "serving_unit": "g",
    "calories": 72,
    "protein_g": 6.3,
    "carbs_g": 0.4,
    "fat_g": 4.8,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_d_mcg": 1.0,
      "_serving_options": [
        {
          "label": "1 large",
          "grams": 50,
          "is_default": True
        },
        {
          "label": "2 eggs",
          "grams": 100
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Egg Whites",
    "category": "Protein",
    "region": "Global",
    "serving_size": 33,
    "serving_unit": "g",
    "calories": 17,
    "protein_g": 3.6,
    "carbs_g": 0.2,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 white",
          "grams": 33,
          "is_default": True
        },
        {
          "label": "3 whites",
          "grams": 99
        }
      ]
    }
  },
  {
    "name": "Tofu (firm)",
    "category": "Protein",
    "region": "Global",
    "serving_size": 126,
    "serving_unit": "g",
    "calories": 88,
    "protein_g": 10.1,
    "carbs_g": 2.2,
    "fat_g": 5.3,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 253,
      "iron_mg": 1.8,
      "_serving_options": [
        {
          "label": "1/2 cup",
          "grams": 126,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Tempeh",
    "category": "Protein",
    "region": "Global",
    "serving_size": 84,
    "serving_unit": "g",
    "calories": 162,
    "protein_g": 15.4,
    "carbs_g": 9.4,
    "fat_g": 9.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "3 oz",
          "grams": 84,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Lentils (cooked)",
    "category": "Protein",
    "region": "Global",
    "serving_size": 198,
    "serving_unit": "g",
    "calories": 230,
    "protein_g": 17.9,
    "carbs_g": 39.9,
    "fat_g": 0.8,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 15.6,
      "iron_mg": 6.6,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 198,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Chickpeas (cooked)",
    "category": "Protein",
    "region": "Global",
    "serving_size": 164,
    "serving_unit": "g",
    "calories": 269,
    "protein_g": 14.5,
    "carbs_g": 45.0,
    "fat_g": 4.2,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 12.5,
      "iron_mg": 4.7,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 164,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Black Beans (cooked)",
    "category": "Protein",
    "region": "Global",
    "serving_size": 172,
    "serving_unit": "g",
    "calories": 227,
    "protein_g": 15.2,
    "carbs_g": 40.8,
    "fat_g": 0.9,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 15.0,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 172,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Greek Yogurt",
    "category": "Protein",
    "region": "Global",
    "serving_size": 170,
    "serving_unit": "g",
    "calories": 100,
    "protein_g": 17.3,
    "carbs_g": 6.1,
    "fat_g": 0.7,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 187,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 170,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cottage Cheese",
    "category": "Protein",
    "region": "Global",
    "serving_size": 113,
    "serving_unit": "g",
    "calories": 81,
    "protein_g": 14.0,
    "carbs_g": 3.2,
    "fat_g": 1.2,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 69,
      "_serving_options": [
        {
          "label": "1/2 cup",
          "grams": 113,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Whey Protein",
    "category": "Protein",
    "region": "Global",
    "serving_size": 30,
    "serving_unit": "g",
    "calories": 113,
    "protein_g": 25.0,
    "carbs_g": 2.0,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 scoop",
          "grams": 30,
          "is_default": True
        },
        {
          "label": "2 scoops",
          "grams": 60
        }
      ]
    }
  },
  {
    "name": "Peanut Butter",
    "category": "Protein",
    "region": "Global",
    "serving_size": 32,
    "serving_unit": "g",
    "calories": 188,
    "protein_g": 8.0,
    "carbs_g": 6.0,
    "fat_g": 16.0,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 1.9,
      "magnesium_mg": 49,
      "_serving_options": [
        {
          "label": "2 tbsp",
          "grams": 32,
          "is_default": True
        },
        {
          "label": "1 tbsp",
          "grams": 16
        }
      ]
    }
  },
  {
    "name": "Almond Butter",
    "category": "Protein",
    "region": "Global",
    "serving_size": 32,
    "serving_unit": "g",
    "calories": 196,
    "protein_g": 6.8,
    "carbs_g": 6.0,
    "fat_g": 17.8,
    "source": "usda",
    "micro_nutrients": {
      "magnesium_mg": 89,
      "_serving_options": [
        {
          "label": "2 tbsp",
          "grams": 32,
          "is_default": True
        },
        {
          "label": "1 tbsp",
          "grams": 16
        }
      ]
    }
  },
  {
    "name": "Chia Seeds",
    "category": "Protein",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 138,
    "protein_g": 4.7,
    "carbs_g": 12.0,
    "fat_g": 8.7,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 9.8,
      "omega_3_g": 5.0,
      "_serving_options": [
        {
          "label": "2 tbsp",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Paneer",
    "category": "Protein",
    "region": "Indian",
    "serving_size": 100,
    "serving_unit": "g",
    "calories": 265,
    "protein_g": 18.3,
    "carbs_g": 1.2,
    "fat_g": 20.8,
    "source": "verified",
    "micro_nutrients": {
      "calcium_mg": 480,
      "_serving_options": [
        {
          "label": "100g",
          "grams": 100,
          "is_default": True
        },
        {
          "label": "50g",
          "grams": 50
        }
      ]
    }
  },
  {
    "name": "White Rice (cooked)",
    "category": "Grain",
    "region": "Global",
    "serving_size": 158,
    "serving_unit": "g",
    "calories": 206,
    "protein_g": 4.3,
    "carbs_g": 44.5,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 158,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Brown Rice (cooked)",
    "category": "Grain",
    "region": "Global",
    "serving_size": 195,
    "serving_unit": "g",
    "calories": 216,
    "protein_g": 5.0,
    "carbs_g": 44.8,
    "fat_g": 1.8,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.5,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 195,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Quinoa (cooked)",
    "category": "Grain",
    "region": "Global",
    "serving_size": 185,
    "serving_unit": "g",
    "calories": 222,
    "protein_g": 8.1,
    "carbs_g": 39.4,
    "fat_g": 3.6,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 5.2,
      "iron_mg": 2.8,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 185,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Oats (dry)",
    "category": "Grain",
    "region": "Global",
    "serving_size": 40,
    "serving_unit": "g",
    "calories": 150,
    "protein_g": 5.3,
    "carbs_g": 27.0,
    "fat_g": 2.6,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 4.0,
      "_serving_options": [
        {
          "label": "1/2 cup",
          "grams": 40,
          "is_default": True
        },
        {
          "label": "1 cup",
          "grams": 80
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Whole Wheat Bread",
    "category": "Grain",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 69,
    "protein_g": 3.6,
    "carbs_g": 11.6,
    "fat_g": 1.2,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 1.9,
      "_serving_options": [
        {
          "label": "1 slice",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "2 slices",
          "grams": 56
        }
      ]
    }
  },
  {
    "name": "White Bread",
    "category": "Grain",
    "region": "Global",
    "serving_size": 25,
    "serving_unit": "g",
    "calories": 67,
    "protein_g": 1.9,
    "carbs_g": 12.7,
    "fat_g": 0.8,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 slice",
          "grams": 25,
          "is_default": True
        },
        {
          "label": "2 slices",
          "grams": 50
        }
      ]
    }
  },
  {
    "name": "Pasta (cooked)",
    "category": "Grain",
    "region": "Global",
    "serving_size": 140,
    "serving_unit": "g",
    "calories": 220,
    "protein_g": 8.1,
    "carbs_g": 43.2,
    "fat_g": 1.3,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 140,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Tortilla (flour)",
    "category": "Grain",
    "region": "Global",
    "serving_size": 45,
    "serving_unit": "g",
    "calories": 140,
    "protein_g": 3.6,
    "carbs_g": 23.6,
    "fat_g": 3.5,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 45,
          "is_default": True
        },
        {
          "label": "1 large",
          "grams": 64
        }
      ]
    }
  },
  {
    "name": "Bagel",
    "category": "Grain",
    "region": "Global",
    "serving_size": 105,
    "serving_unit": "g",
    "calories": 270,
    "protein_g": 10.0,
    "carbs_g": 53.0,
    "fat_g": 1.6,
    "source": "usda",
    "micro_nutrients": {
      "iron_mg": 3.8,
      "_serving_options": [
        {
          "label": "1 bagel",
          "grams": 105,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Granola",
    "category": "Grain",
    "region": "Global",
    "serving_size": 55,
    "serving_unit": "g",
    "calories": 260,
    "protein_g": 6.0,
    "carbs_g": 33.0,
    "fat_g": 12.0,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.5,
      "_serving_options": [
        {
          "label": "1/2 cup",
          "grams": 55,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Basmati Rice",
    "category": "Grain",
    "region": "Indian",
    "serving_size": 163,
    "serving_unit": "g",
    "calories": 210,
    "protein_g": 4.4,
    "carbs_g": 45.6,
    "fat_g": 0.5,
    "source": "verified",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 163,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Whole Milk",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 244,
    "serving_unit": "ml",
    "calories": 149,
    "protein_g": 8.0,
    "carbs_g": 11.7,
    "fat_g": 7.9,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 276,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 244,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Skim Milk",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 245,
    "serving_unit": "ml",
    "calories": 83,
    "protein_g": 8.3,
    "carbs_g": 12.2,
    "fat_g": 0.2,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 299,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 245,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cheddar Cheese",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 113,
    "protein_g": 7.0,
    "carbs_g": 0.4,
    "fat_g": 9.3,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 200,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Mozzarella",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 85,
    "protein_g": 6.3,
    "carbs_g": 0.7,
    "fat_g": 6.3,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 143,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Butter",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 14,
    "serving_unit": "g",
    "calories": 102,
    "protein_g": 0.1,
    "carbs_g": 0.0,
    "fat_g": 11.5,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 14,
          "is_default": True
        },
        {
          "label": "1 pat",
          "grams": 5
        }
      ]
    }
  },
  {
    "name": "Almond Milk",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 240,
    "serving_unit": "ml",
    "calories": 30,
    "protein_g": 1.0,
    "carbs_g": 1.0,
    "fat_g": 2.5,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 451,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 240,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Oat Milk",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 240,
    "serving_unit": "ml",
    "calories": 120,
    "protein_g": 3.0,
    "carbs_g": 16.0,
    "fat_g": 5.0,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 350,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 240,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Yogurt (plain)",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 245,
    "serving_unit": "g",
    "calories": 149,
    "protein_g": 8.5,
    "carbs_g": 11.4,
    "fat_g": 8.0,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 296,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 245,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Ghee",
    "category": "Dairy",
    "region": "Indian",
    "serving_size": 14,
    "serving_unit": "g",
    "calories": 123,
    "protein_g": 0.0,
    "carbs_g": 0.0,
    "fat_g": 14.0,
    "source": "verified",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 14,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Feta Cheese",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 75,
    "protein_g": 4.0,
    "carbs_g": 1.2,
    "fat_g": 6.0,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 140,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Heavy Cream",
    "category": "Dairy",
    "region": "Global",
    "serving_size": 15,
    "serving_unit": "ml",
    "calories": 51,
    "protein_g": 0.3,
    "carbs_g": 0.4,
    "fat_g": 5.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 15,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Almonds",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 164,
    "protein_g": 6.0,
    "carbs_g": 6.1,
    "fat_g": 14.2,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.5,
      "magnesium_mg": 76,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Walnuts",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 185,
    "protein_g": 4.3,
    "carbs_g": 3.9,
    "fat_g": 18.5,
    "source": "usda",
    "micro_nutrients": {
      "omega_3_g": 2.6,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Cashews",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 157,
    "protein_g": 5.2,
    "carbs_g": 8.6,
    "fat_g": 12.4,
    "source": "usda",
    "micro_nutrients": {
      "magnesium_mg": 83,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Peanuts",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 161,
    "protein_g": 7.3,
    "carbs_g": 4.6,
    "fat_g": 14.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pistachios",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 159,
    "protein_g": 5.7,
    "carbs_g": 7.7,
    "fat_g": 12.9,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Sunflower Seeds",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 165,
    "protein_g": 5.5,
    "carbs_g": 6.5,
    "fat_g": 14.0,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_e_mg": 7.4,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pumpkin Seeds",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 151,
    "protein_g": 7.0,
    "carbs_g": 5.0,
    "fat_g": 13.0,
    "source": "usda",
    "micro_nutrients": {
      "magnesium_mg": 150,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Flax Seeds",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 10,
    "serving_unit": "g",
    "calories": 55,
    "protein_g": 1.9,
    "carbs_g": 3.0,
    "fat_g": 4.3,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 2.8,
      "omega_3_g": 2.4,
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 10,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Tahini",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 15,
    "serving_unit": "g",
    "calories": 89,
    "protein_g": 2.6,
    "carbs_g": 3.2,
    "fat_g": 8.0,
    "source": "usda",
    "micro_nutrients": {
      "calcium_mg": 64,
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 15,
          "is_default": True
        },
        {
          "label": "2 tbsp",
          "grams": 30
        }
      ]
    }
  },
  {
    "name": "Mixed Nuts",
    "category": "Nuts",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 172,
    "protein_g": 5.0,
    "carbs_g": 7.0,
    "fat_g": 15.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Olive Oil",
    "category": "Oil",
    "region": "Global",
    "serving_size": 14,
    "serving_unit": "ml",
    "calories": 119,
    "protein_g": 0.0,
    "carbs_g": 0.0,
    "fat_g": 13.5,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 14,
          "is_default": True
        },
        {
          "label": "1 tsp",
          "grams": 5
        }
      ]
    }
  },
  {
    "name": "Coconut Oil",
    "category": "Oil",
    "region": "Global",
    "serving_size": 14,
    "serving_unit": "ml",
    "calories": 121,
    "protein_g": 0.0,
    "carbs_g": 0.0,
    "fat_g": 13.5,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 14,
          "is_default": True
        },
        {
          "label": "1 tsp",
          "grams": 5
        }
      ]
    }
  },
  {
    "name": "Avocado Oil",
    "category": "Oil",
    "region": "Global",
    "serving_size": 14,
    "serving_unit": "ml",
    "calories": 124,
    "protein_g": 0.0,
    "carbs_g": 0.0,
    "fat_g": 14.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 14,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Sesame Oil",
    "category": "Oil",
    "region": "Global",
    "serving_size": 14,
    "serving_unit": "ml",
    "calories": 120,
    "protein_g": 0.0,
    "carbs_g": 0.0,
    "fat_g": 13.6,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 tbsp",
          "grams": 14,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Coffee (black)",
    "category": "Beverage",
    "region": "Global",
    "serving_size": 237,
    "serving_unit": "ml",
    "calories": 2,
    "protein_g": 0.3,
    "carbs_g": 0.0,
    "fat_g": 0.0,
    "source": "usda",
    "micro_nutrients": {
      "potassium_mg": 116,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 237,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Green Tea",
    "category": "Beverage",
    "region": "Global",
    "serving_size": 237,
    "serving_unit": "ml",
    "calories": 2,
    "protein_g": 0.5,
    "carbs_g": 0.0,
    "fat_g": 0.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 237,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Orange Juice",
    "category": "Beverage",
    "region": "Global",
    "serving_size": 248,
    "serving_unit": "ml",
    "calories": 112,
    "protein_g": 1.7,
    "carbs_g": 25.8,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "vitamin_c_mg": 124,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 248,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Apple Juice",
    "category": "Beverage",
    "region": "Global",
    "serving_size": 248,
    "serving_unit": "ml",
    "calories": 114,
    "protein_g": 0.3,
    "carbs_g": 28.0,
    "fat_g": 0.3,
    "source": "usda",
    "micro_nutrients": {
      "potassium_mg": 250,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 248,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Coconut Water",
    "category": "Beverage",
    "region": "Global",
    "serving_size": 240,
    "serving_unit": "ml",
    "calories": 46,
    "protein_g": 1.7,
    "carbs_g": 8.9,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "potassium_mg": 600,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 240,
          "is_default": True
        },
        {
          "label": "100ml",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Dark Chocolate",
    "category": "Snack",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 170,
    "protein_g": 2.2,
    "carbs_g": 13.0,
    "fat_g": 12.0,
    "source": "usda",
    "micro_nutrients": {
      "iron_mg": 3.4,
      "magnesium_mg": 64,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Popcorn (air-popped)",
    "category": "Snack",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 110,
    "protein_g": 3.1,
    "carbs_g": 22.1,
    "fat_g": 1.3,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 3.6,
      "_serving_options": [
        {
          "label": "3 cups",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Hummus",
    "category": "Snack",
    "region": "Global",
    "serving_size": 30,
    "serving_unit": "g",
    "calories": 52,
    "protein_g": 2.4,
    "carbs_g": 4.6,
    "fat_g": 3.0,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 1.5,
      "_serving_options": [
        {
          "label": "2 tbsp",
          "grams": 30,
          "is_default": True
        },
        {
          "label": "1/4 cup",
          "grams": 62
        }
      ]
    }
  },
  {
    "name": "Protein Bar",
    "category": "Snack",
    "region": "Global",
    "serving_size": 60,
    "serving_unit": "g",
    "calories": 210,
    "protein_g": 20.0,
    "carbs_g": 22.0,
    "fat_g": 7.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 bar",
          "grams": 60,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Raisins",
    "category": "Snack",
    "region": "Global",
    "serving_size": 28,
    "serving_unit": "g",
    "calories": 85,
    "protein_g": 0.9,
    "carbs_g": 22.5,
    "fat_g": 0.1,
    "source": "usda",
    "micro_nutrients": {
      "potassium_mg": 212,
      "_serving_options": [
        {
          "label": "1 oz",
          "grams": 28,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Pancakes",
    "category": "Snack",
    "region": "Global",
    "serving_size": 77,
    "serving_unit": "g",
    "calories": 175,
    "protein_g": 4.8,
    "carbs_g": 22.2,
    "fat_g": 7.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 medium",
          "grams": 77,
          "is_default": True
        },
        {
          "label": "2 pancakes",
          "grams": 154
        }
      ]
    }
  },
  {
    "name": "Overnight Oats",
    "category": "Snack",
    "region": "Global",
    "serving_size": 245,
    "serving_unit": "g",
    "calories": 307,
    "protein_g": 11.0,
    "carbs_g": 51.0,
    "fat_g": 7.0,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 5.0,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 245,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Sushi Rice",
    "category": "International",
    "region": "Japanese",
    "serving_size": 186,
    "serving_unit": "g",
    "calories": 242,
    "protein_g": 4.4,
    "carbs_g": 53.4,
    "fat_g": 0.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 186,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Miso Soup",
    "category": "International",
    "region": "Japanese",
    "serving_size": 240,
    "serving_unit": "ml",
    "calories": 40,
    "protein_g": 3.0,
    "carbs_g": 5.0,
    "fat_g": 1.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 240,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Kimchi",
    "category": "International",
    "region": "Korean",
    "serving_size": 150,
    "serving_unit": "g",
    "calories": 23,
    "protein_g": 1.6,
    "carbs_g": 4.0,
    "fat_g": 0.5,
    "source": "usda",
    "micro_nutrients": {
      "fibre_g": 2.4,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 150,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Falafel",
    "category": "International",
    "region": "Middle Eastern",
    "serving_size": 17,
    "serving_unit": "g",
    "calories": 57,
    "protein_g": 2.3,
    "carbs_g": 5.4,
    "fat_g": 3.4,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 piece",
          "grams": 17,
          "is_default": True
        },
        {
          "label": "4 pieces",
          "grams": 68
        }
      ]
    }
  },
  {
    "name": "Pad Thai",
    "category": "International",
    "region": "Thai",
    "serving_size": 275,
    "serving_unit": "g",
    "calories": 400,
    "protein_g": 15.0,
    "carbs_g": 55.0,
    "fat_g": 14.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 serving",
          "grams": 275,
          "is_default": True
        }
      ]
    }
  },
  {
    "name": "Biryani",
    "category": "International",
    "region": "Indian",
    "serving_size": 250,
    "serving_unit": "g",
    "calories": 400,
    "protein_g": 22.0,
    "carbs_g": 50.0,
    "fat_g": 12.0,
    "source": "verified",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 serving",
          "grams": 250,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Dal",
    "category": "International",
    "region": "Indian",
    "serving_size": 200,
    "serving_unit": "g",
    "calories": 180,
    "protein_g": 10.0,
    "carbs_g": 28.0,
    "fat_g": 3.0,
    "source": "verified",
    "micro_nutrients": {
      "fibre_g": 6.0,
      "iron_mg": 3.0,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 200,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Butter Chicken",
    "category": "International",
    "region": "Indian",
    "serving_size": 250,
    "serving_unit": "g",
    "calories": 438,
    "protein_g": 28.0,
    "carbs_g": 12.0,
    "fat_g": 30.0,
    "source": "verified",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 serving",
          "grams": 250,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Chole",
    "category": "International",
    "region": "Indian",
    "serving_size": 200,
    "serving_unit": "g",
    "calories": 240,
    "protein_g": 10.0,
    "carbs_g": 32.0,
    "fat_g": 8.0,
    "source": "verified",
    "micro_nutrients": {
      "fibre_g": 8.0,
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 200,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Idli",
    "category": "International",
    "region": "Indian",
    "serving_size": 40,
    "serving_unit": "g",
    "calories": 39,
    "protein_g": 2.0,
    "carbs_g": 8.0,
    "fat_g": 0.2,
    "source": "verified",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 piece",
          "grams": 40,
          "is_default": True
        },
        {
          "label": "3 pieces",
          "grams": 120
        }
      ]
    }
  },
  {
    "name": "Dosa",
    "category": "International",
    "region": "Indian",
    "serving_size": 100,
    "serving_unit": "g",
    "calories": 168,
    "protein_g": 4.0,
    "carbs_g": 28.0,
    "fat_g": 4.0,
    "source": "verified",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 dosa",
          "grams": 100,
          "is_default": True
        },
        {
          "label": "2 dosas",
          "grams": 200
        }
      ]
    }
  },
  {
    "name": "Samosa",
    "category": "International",
    "region": "Indian",
    "serving_size": 100,
    "serving_unit": "g",
    "calories": 262,
    "protein_g": 5.0,
    "carbs_g": 28.0,
    "fat_g": 14.0,
    "source": "verified",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 piece",
          "grams": 100,
          "is_default": True
        },
        {
          "label": "2 pieces",
          "grams": 200
        }
      ]
    }
  },
  {
    "name": "Jollof Rice",
    "category": "International",
    "region": "West African",
    "serving_size": 175,
    "serving_unit": "g",
    "calories": 260,
    "protein_g": 5.0,
    "carbs_g": 42.0,
    "fat_g": 8.0,
    "source": "usda",
    "micro_nutrients": {
      "_serving_options": [
        {
          "label": "1 cup",
          "grams": 175,
          "is_default": True
        },
        {
          "label": "100g",
          "grams": 100
        }
      ]
    }
  },
  {
    "name": "Injera",
    "category": "International",
    "region": "Ethiopian",
    "serving_size": 100,
    "serving_unit": "g",
    "calories": 145,
    "protein_g": 5.0,
    "carbs_g": 28.0,
    "fat_g": 1.0,
    "source": "usda",
    "micro_nutrients": {
      "iron_mg": 3.0,
      "_serving_options": [
        {
          "label": "1 piece",
          "grams": 100,
          "is_default": True
        }
      ]
    }
  }
]
