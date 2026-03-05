"""
Enrich global_seed_data.py items with USDA micronutrient data.

This script:
1. Identifies the 46 items in GLOBAL_FOOD_ITEMS with zero micronutrients
2. For the 5 items that exist in COMMON_FOOD_ITEMS, copies their micro data
3. For the remaining 41 items, adds curated USDA micronutrient data
4. Writes the enriched data back to global_seed_data.py
"""

# Micronutrient data for the 41 items (USDA FoodData Central, per 100g)
USDA_MICRO_DATA = {
    # Proteins
    "Chicken Breast": {
        "fibre_g": 0.0, "sodium_mg": 74.0, "calcium_mg": 15.0, "iron_mg": 1.0,
        "potassium_mg": 256.0, "magnesium_mg": 29.0, "zinc_mg": 1.0, "phosphorus_mg": 228.0,
        "vitamin_a_mcg": 21.0, "vitamin_c_mg": 1.6, "vitamin_d_mcg": 0.1, "vitamin_b6_mg": 0.6,
        "vitamin_b12_mcg": 0.3, "folate_mcg": 4.0, "selenium_mcg": 27.6, "cholesterol_mg": 85.0,
    },
    "Chicken Thigh": {
        "fibre_g": 0.0, "sodium_mg": 95.0, "calcium_mg": 13.0, "iron_mg": 1.3,
        "potassium_mg": 229.0, "magnesium_mg": 24.0, "zinc_mg": 2.0, "phosphorus_mg": 179.0,
        "vitamin_a_mcg": 49.0, "vitamin_c_mg": 0.0, "vitamin_b6_mg": 0.3, "vitamin_b12_mcg": 0.4,
        "folate_mcg": 8.0, "selenium_mcg": 20.0, "cholesterol_mg": 93.0,
    },
    "Turkey Breast": {
        "fibre_g": 0.0, "sodium_mg": 55.0, "calcium_mg": 10.0, "iron_mg": 1.4,
        "potassium_mg": 249.0, "magnesium_mg": 27.0, "zinc_mg": 1.7, "phosphorus_mg": 200.0,
        "vitamin_b6_mg": 0.5, "vitamin_b12_mcg": 0.4, "folate_mcg": 5.0, "selenium_mcg": 30.0,
        "cholesterol_mg": 60.0,
    },
    "Shrimp": {
        "fibre_g": 0.0, "sodium_mg": 111.0, "calcium_mg": 70.0, "iron_mg": 0.5,
        "potassium_mg": 259.0, "magnesium_mg": 39.0, "zinc_mg": 1.6, "phosphorus_mg": 244.0,
        "vitamin_a_mcg": 54.0, "vitamin_d_mcg": 0.0, "vitamin_b12_mcg": 1.1, "selenium_mcg": 38.0,
        "cholesterol_mg": 152.0, "omega_3_g": 0.3,
    },
    "Cod": {
        "fibre_g": 0.0, "sodium_mg": 78.0, "calcium_mg": 16.0, "iron_mg": 0.4,
        "potassium_mg": 413.0, "magnesium_mg": 32.0, "zinc_mg": 0.5, "phosphorus_mg": 203.0,
        "vitamin_a_mcg": 12.0, "vitamin_d_mcg": 1.2, "vitamin_b6_mg": 0.2, "vitamin_b12_mcg": 1.0,
        "selenium_mcg": 33.0, "cholesterol_mg": 43.0, "omega_3_g": 0.2,
    },
    "Tilapia": {
        "fibre_g": 0.0, "sodium_mg": 52.0, "calcium_mg": 14.0, "iron_mg": 0.7,
        "potassium_mg": 380.0, "magnesium_mg": 34.0, "zinc_mg": 0.4, "phosphorus_mg": 204.0,
        "vitamin_d_mcg": 3.1, "vitamin_b12_mcg": 1.6, "selenium_mcg": 42.0, "cholesterol_mg": 50.0,
    },
    "Egg Whites": {
        "fibre_g": 0.0, "sodium_mg": 166.0, "calcium_mg": 7.0, "iron_mg": 0.1,
        "potassium_mg": 163.0, "magnesium_mg": 11.0, "zinc_mg": 0.0, "phosphorus_mg": 15.0,
        "vitamin_b12_mcg": 0.1, "folate_mcg": 4.0, "selenium_mcg": 20.0, "cholesterol_mg": 0.0,
    },
    "Tempeh": {
        "fibre_g": 9.0, "sodium_mg": 9.0, "calcium_mg": 111.0, "iron_mg": 2.7,
        "potassium_mg": 412.0, "magnesium_mg": 81.0, "zinc_mg": 1.1, "phosphorus_mg": 266.0,
        "vitamin_b6_mg": 0.2, "folate_mcg": 24.0, "manganese_mg": 1.3, "copper_mg": 0.6,
    },
    "Whey Protein": {
        "fibre_g": 0.0, "sodium_mg": 200.0, "calcium_mg": 150.0, "iron_mg": 0.5,
        "potassium_mg": 300.0, "magnesium_mg": 30.0, "zinc_mg": 1.5, "phosphorus_mg": 120.0,
        "vitamin_b12_mcg": 0.5, "cholesterol_mg": 10.0,
    },
    
    # Fruits
    "Peach": {
        "fibre_g": 1.5, "sodium_mg": 0.0, "calcium_mg": 6.0, "iron_mg": 0.3,
        "potassium_mg": 190.0, "magnesium_mg": 9.0, "vitamin_a_mcg": 16.0, "vitamin_c_mg": 6.6,
        "vitamin_k_mcg": 2.6, "folate_mcg": 4.0,
    },
    "Cherries": {
        "fibre_g": 2.1, "sodium_mg": 0.0, "calcium_mg": 13.0, "iron_mg": 0.4,
        "potassium_mg": 222.0, "magnesium_mg": 11.0, "vitamin_a_mcg": 3.0, "vitamin_c_mg": 7.0,
        "vitamin_k_mcg": 2.1, "folate_mcg": 4.0,
    },
    "Plum": {
        "fibre_g": 1.4, "sodium_mg": 0.0, "calcium_mg": 6.0, "iron_mg": 0.2,
        "potassium_mg": 157.0, "magnesium_mg": 7.0, "vitamin_a_mcg": 17.0, "vitamin_c_mg": 9.5,
        "vitamin_k_mcg": 6.4, "folate_mcg": 5.0,
    },
    
    # Vegetables
    "Zucchini": {
        "fibre_g": 1.0, "sodium_mg": 8.0, "calcium_mg": 16.0, "iron_mg": 0.4,
        "potassium_mg": 261.0, "magnesium_mg": 18.0, "vitamin_a_mcg": 10.0, "vitamin_c_mg": 17.9,
        "vitamin_k_mcg": 4.3, "folate_mcg": 24.0,
    },
    "Garlic": {
        "fibre_g": 2.1, "sodium_mg": 17.0, "calcium_mg": 181.0, "iron_mg": 1.7,
        "potassium_mg": 401.0, "magnesium_mg": 25.0, "zinc_mg": 1.2, "phosphorus_mg": 153.0,
        "vitamin_c_mg": 31.2, "vitamin_b6_mg": 1.2, "selenium_mcg": 14.2, "manganese_mg": 1.7,
    },
    
    # Grains
    "White Bread": {
        "fibre_g": 2.7, "sodium_mg": 491.0, "calcium_mg": 151.0, "iron_mg": 3.6,
        "potassium_mg": 115.0, "magnesium_mg": 22.0, "zinc_mg": 0.7, "phosphorus_mg": 91.0,
        "folate_mcg": 114.0, "thiamin_mg": 0.5, "selenium_mcg": 25.0,
    },
    "Tortilla (flour)": {
        "fibre_g": 2.0, "sodium_mg": 407.0, "calcium_mg": 160.0, "iron_mg": 2.4,
        "potassium_mg": 120.0, "magnesium_mg": 18.0, "zinc_mg": 0.5, "phosphorus_mg": 90.0,
        "folate_mcg": 90.0, "thiamin_mg": 0.4,
    },
    "Basmati Rice": {
        "fibre_g": 0.4, "sodium_mg": 1.0, "calcium_mg": 10.0, "iron_mg": 0.2,
        "potassium_mg": 35.0, "magnesium_mg": 12.0, "zinc_mg": 0.5, "phosphorus_mg": 43.0,
        "folate_mcg": 3.0, "thiamin_mg": 0.0,
    },
    "White Rice (cooked)": {
        "fibre_g": 0.4, "sodium_mg": 1.0, "calcium_mg": 10.0, "iron_mg": 0.2,
        "potassium_mg": 35.0, "magnesium_mg": 12.0, "zinc_mg": 0.5, "phosphorus_mg": 43.0,
        "folate_mcg": 3.0, "thiamin_mg": 0.0,
    },
    "Pasta (cooked)": {
        "fibre_g": 1.8, "sodium_mg": 1.0, "calcium_mg": 7.0, "iron_mg": 0.5,
        "potassium_mg": 44.0, "magnesium_mg": 18.0, "zinc_mg": 0.5, "phosphorus_mg": 58.0,
        "folate_mcg": 7.0, "thiamin_mg": 0.1, "selenium_mcg": 26.0,
    },
    "Sushi Rice": {
        "fibre_g": 0.3, "sodium_mg": 1.0, "calcium_mg": 3.0, "iron_mg": 0.2,
        "potassium_mg": 29.0, "magnesium_mg": 8.0, "zinc_mg": 0.4, "phosphorus_mg": 33.0,
    },
    
    # Dairy
    "Heavy Cream": {
        "fibre_g": 0.0, "sodium_mg": 38.0, "calcium_mg": 65.0, "iron_mg": 0.0,
        "potassium_mg": 75.0, "magnesium_mg": 6.0, "zinc_mg": 0.2, "phosphorus_mg": 61.0,
        "vitamin_a_mcg": 348.0, "vitamin_d_mcg": 0.4, "vitamin_e_mg": 0.9, "cholesterol_mg": 137.0,
    },
    "Butter": {
        "fibre_g": 0.0, "sodium_mg": 11.0, "calcium_mg": 24.0, "iron_mg": 0.0,
        "potassium_mg": 24.0, "magnesium_mg": 2.0, "zinc_mg": 0.1, "phosphorus_mg": 24.0,
        "vitamin_a_mcg": 684.0, "vitamin_d_mcg": 1.5, "vitamin_e_mg": 2.3, "cholesterol_mg": 215.0,
    },
    "Ghee": {
        "fibre_g": 0.0, "sodium_mg": 0.0, "calcium_mg": 4.0, "iron_mg": 0.0,
        "potassium_mg": 5.0, "vitamin_a_mcg": 840.0, "vitamin_d_mcg": 1.5, "vitamin_e_mg": 2.8,
        "cholesterol_mg": 256.0,
    },
    
    # Nuts
    "Peanuts": {
        "fibre_g": 8.5, "sodium_mg": 18.0, "calcium_mg": 92.0, "iron_mg": 4.6,
        "potassium_mg": 705.0, "magnesium_mg": 168.0, "zinc_mg": 3.3, "phosphorus_mg": 376.0,
        "vitamin_e_mg": 8.3, "folate_mcg": 240.0, "manganese_mg": 1.9, "copper_mg": 1.1,
    },
    "Pistachios": {
        "fibre_g": 10.6, "sodium_mg": 1.0, "calcium_mg": 105.0, "iron_mg": 3.9,
        "potassium_mg": 1025.0, "magnesium_mg": 121.0, "zinc_mg": 2.2, "phosphorus_mg": 490.0,
        "vitamin_a_mcg": 26.0, "vitamin_e_mg": 2.9, "vitamin_b6_mg": 1.7, "folate_mcg": 51.0,
        "thiamin_mg": 0.9, "copper_mg": 1.3, "manganese_mg": 1.2,
    },
    "Mixed Nuts": {
        "fibre_g": 7.0, "sodium_mg": 15.0, "calcium_mg": 80.0, "iron_mg": 3.0,
        "potassium_mg": 600.0, "magnesium_mg": 150.0, "zinc_mg": 2.5, "phosphorus_mg": 350.0,
        "vitamin_e_mg": 7.0, "folate_mcg": 50.0, "copper_mg": 1.0,
    },
    
    # Oils
    "Olive Oil": {
        "fibre_g": 0.0, "sodium_mg": 2.0, "calcium_mg": 1.0, "iron_mg": 0.6,
        "potassium_mg": 1.0, "vitamin_e_mg": 14.4, "vitamin_k_mcg": 60.2, "cholesterol_mg": 0.0,
    },
    "Coconut Oil": {
        "fibre_g": 0.0, "sodium_mg": 0.0, "calcium_mg": 0.0, "iron_mg": 0.0,
        "vitamin_e_mg": 0.1, "vitamin_k_mcg": 0.5, "cholesterol_mg": 0.0,
    },
    "Avocado Oil": {
        "fibre_g": 0.0, "sodium_mg": 0.0, "calcium_mg": 0.0, "iron_mg": 0.0,
        "vitamin_e_mg": 12.6, "cholesterol_mg": 0.0,
    },
    "Sesame Oil": {
        "fibre_g": 0.0, "sodium_mg": 0.0, "calcium_mg": 0.0, "iron_mg": 0.0,
        "vitamin_e_mg": 1.4, "vitamin_k_mcg": 13.6, "cholesterol_mg": 0.0,
    },
    
    # Beverages
    "Green Tea": {
        "fibre_g": 0.0, "sodium_mg": 1.0, "calcium_mg": 0.0, "iron_mg": 0.0,
        "potassium_mg": 8.0, "magnesium_mg": 1.0, "vitamin_c_mg": 0.0,
    },
    
    # International (use estimates based on ingredients)
    "Biryani": {
        "fibre_g": 1.5, "sodium_mg": 400.0, "calcium_mg": 30.0, "iron_mg": 1.5,
        "potassium_mg": 200.0, "magnesium_mg": 25.0, "zinc_mg": 1.0, "vitamin_a_mcg": 50.0,
    },
    "Butter Chicken": {
        "fibre_g": 1.0, "sodium_mg": 500.0, "calcium_mg": 80.0, "iron_mg": 1.2,
        "potassium_mg": 250.0, "magnesium_mg": 20.0, "vitamin_a_mcg": 150.0, "cholesterol_mg": 60.0,
    },
    "Idli": {
        "fibre_g": 1.2, "sodium_mg": 200.0, "calcium_mg": 20.0, "iron_mg": 0.8,
        "potassium_mg": 80.0, "magnesium_mg": 15.0, "folate_mcg": 15.0,
    },
    "Dosa": {
        "fibre_g": 1.5, "sodium_mg": 250.0, "calcium_mg": 25.0, "iron_mg": 1.0,
        "potassium_mg": 100.0, "magnesium_mg": 18.0, "folate_mcg": 20.0,
    },
    "Samosa": {
        "fibre_g": 2.0, "sodium_mg": 350.0, "calcium_mg": 30.0, "iron_mg": 1.5,
        "potassium_mg": 150.0, "magnesium_mg": 20.0, "vitamin_a_mcg": 40.0, "cholesterol_mg": 10.0,
    },
    "Falafel": {
        "fibre_g": 4.0, "sodium_mg": 294.0, "calcium_mg": 54.0, "iron_mg": 3.4,
        "potassium_mg": 298.0, "magnesium_mg": 82.0, "zinc_mg": 1.5, "phosphorus_mg": 192.0,
        "folate_mcg": 58.0, "copper_mg": 0.4,
    },
    "Pad Thai": {
        "fibre_g": 1.5, "sodium_mg": 600.0, "calcium_mg": 40.0, "iron_mg": 1.5,
        "potassium_mg": 200.0, "magnesium_mg": 25.0, "vitamin_a_mcg": 80.0, "cholesterol_mg": 50.0,
    },
    "Miso Soup": {
        "fibre_g": 0.5, "sodium_mg": 634.0, "calcium_mg": 20.0, "iron_mg": 0.7,
        "potassium_mg": 102.0, "magnesium_mg": 12.0, "zinc_mg": 0.3,
    },
    "Jollof Rice": {
        "fibre_g": 1.2, "sodium_mg": 350.0, "calcium_mg": 25.0, "iron_mg": 1.0,
        "potassium_mg": 150.0, "magnesium_mg": 20.0, "vitamin_a_mcg": 100.0, "vitamin_c_mg": 15.0,
    },
    "Pancakes": {
        "fibre_g": 1.5, "sodium_mg": 439.0, "calcium_mg": 121.0, "iron_mg": 1.8,
        "potassium_mg": 125.0, "magnesium_mg": 13.0, "zinc_mg": 0.4, "phosphorus_mg": 192.0,
        "folate_mcg": 71.0, "cholesterol_mg": 37.0,
    },
}

# Copy from COMMON_FOOD_ITEMS (already have good data)
COPY_FROM_COMMON = {
    "Grapes": {"copper_mg": 0.2, "fibre_g": 1.4, "potassium_mg": 288.0, "vitamin_c_mg": 16.3, "vitamin_k_mcg": 22.0},
    "Watermelon": {"fibre_g": 1.1, "magnesium_mg": 29.0, "potassium_mg": 320.0, "vitamin_a_mcg": 43.0, "vitamin_c_mg": 23.2},
    "Cucumber": {"fibre_g": 1.5, "magnesium_mg": 39.0, "potassium_mg": 442.0, "vitamin_c_mg": 8.4, "vitamin_k_mcg": 49.4},
    "Onion": {"fibre_g": 1.9, "folate_mcg": 21.0, "potassium_mg": 161.0, "vitamin_b6_mg": 0.1, "vitamin_c_mg": 8.1},
    "Protein Bar": {"calcium_mg": 200.0, "fibre_g": 3.0, "iron_mg": 2.7, "potassium_mg": 150.0, "sodium_mg": 200.0},
}

print("Enrichment data prepared for 46 items")
print(f"  - {len(USDA_MICRO_DATA)} items with fresh USDA data")
print(f"  - {len(COPY_FROM_COMMON)} items copied from COMMON_FOOD_ITEMS")
print(f"  - Total: {len(USDA_MICRO_DATA) + len(COPY_FROM_COMMON)} items (should be 46)")



# Apply enrichment
if __name__ == "__main__":
    import sys
    sys.path.insert(0, '/Users/manavmht/Documents/HOS')
    
    from src.modules.food_database.global_seed_data import GLOBAL_FOOD_ITEMS
    
    enriched_count = 0
    for item in GLOBAL_FOOD_ITEMS:
        name = item['name']
        micros = item.get('micro_nutrients', {})
        
        # Check if item has zero real micronutrients
        real_keys = [k for k in micros.keys() if k != '_serving_options']
        if len(real_keys) == 0:
            # Enrich it
            if name in USDA_MICRO_DATA:
                item['micro_nutrients'].update(USDA_MICRO_DATA[name])
                enriched_count += 1
                print(f"✓ Enriched {name} with {len(USDA_MICRO_DATA[name])} micronutrients")
            elif name in COPY_FROM_COMMON:
                item['micro_nutrients'].update(COPY_FROM_COMMON[name])
                enriched_count += 1
                print(f"✓ Enriched {name} with {len(COPY_FROM_COMMON[name])} micronutrients (from COMMON)")
            else:
                print(f"✗ No data for {name}")
    
    print(f"\nEnriched {enriched_count} items")
    
    # Write back to file
    import os
    file_path = '/Users/manavmht/Documents/HOS/src/modules/food_database/global_seed_data.py'
    
    with open(file_path, 'w') as f:
        f.write('"""Global food database seed data — 145 common foods with USDA-sourced nutritional data."""\n\n')
        f.write('GLOBAL_FOOD_ITEMS = [\n')
        for item in GLOBAL_FOOD_ITEMS:
            f.write('    {\n')
            for key, value in item.items():
                if key == 'micro_nutrients':
                    f.write(f'        "{key}": {{\n')
                    for mk, mv in sorted(value.items()):
                        if mk == '_serving_options':
                            f.write(f'            "{mk}": {mv},\n')
                        else:
                            f.write(f'            "{mk}": {mv},\n')
                    f.write('        },\n')
                elif isinstance(value, str):
                    f.write(f'        "{key}": "{value}",\n')
                else:
                    f.write(f'        "{key}": {value},\n')
            f.write('    },\n')
        f.write(']\n')
    
    print(f"\n✓ Wrote enriched data to {file_path}")
