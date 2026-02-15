#!/usr/bin/env python3
"""Generate the global_seed_data.py file."""
import json

HEADER = '''"""Global food database with USDA-sourced nutrition data."""
from __future__ import annotations

GLOBAL_FOOD_ITEMS: list[dict] = '''

items = []

def add(n,cat,ss,su,cal,p,c,f,mi=None,opts=None,rg="Global",src="usda"):
    mn = dict(mi) if mi else {}
    if opts:
        mn["_serving_options"] = opts
    items.append({"name":n,"category":cat,"region":rg,"serving_size":ss,"serving_unit":su,
        "calories":cal,"protein_g":p,"carbs_g":c,"fat_g":f,"source":src,
        "micro_nutrients":mn if mn else None})

def o(l,g,d=False):
    r = {"label":l,"grams":g}
    if d: r["is_default"] = True
    return r

# FRUITS
add("Apple","Fruit",182,"g",95,0.5,25.1,0.3,{"fibre_g":4.4,"vitamin_c_mg":8.4,"potassium_mg":195},[o("1 medium",182,True),o("100g",100)])
add("Banana","Fruit",118,"g",105,1.3,27.0,0.4,{"fibre_g":3.1,"potassium_mg":422},[o("1 medium",118,True),o("100g",100)])
add("Orange","Fruit",131,"g",62,1.2,15.4,0.2,{"vitamin_c_mg":69.7},[o("1 medium",131,True),o("100g",100)])
add("Mango","Fruit",165,"g",99,1.4,24.7,0.6,{"vitamin_c_mg":60.1},[o("1 cup",165,True),o("100g",100)])
add("Grapes","Fruit",151,"g",104,1.1,27.3,0.2,None,[o("1 cup",151,True),o("100g",100)])
add("Strawberries","Fruit",152,"g",49,1.0,11.7,0.5,{"vitamin_c_mg":89.4},[o("1 cup",152,True),o("100g",100)])
add("Blueberries","Fruit",148,"g",84,1.1,21.4,0.5,{"fibre_g":3.6},[o("1 cup",148,True),o("100g",100)])
add("Watermelon","Fruit",286,"g",86,1.7,21.6,0.4,None,[o("2 cups",286,True),o("100g",100)])
add("Pineapple","Fruit",165,"g",82,0.9,21.6,0.2,{"vitamin_c_mg":78.9},[o("1 cup",165,True),o("100g",100)])
add("Papaya","Fruit",145,"g",62,0.7,15.7,0.4,{"vitamin_c_mg":88.3},[o("1 cup",145,True),o("100g",100)])
add("Kiwi","Fruit",69,"g",42,0.8,10.1,0.4,{"vitamin_c_mg":64.0},[o("1 medium",69,True),o("100g",100)])
add("Peach","Fruit",150,"g",59,1.4,14.3,0.4,None,[o("1 medium",150,True),o("100g",100)])
add("Pear","Fruit",178,"g",101,0.6,27.1,0.3,{"fibre_g":5.5},[o("1 medium",178,True),o("100g",100)])
add("Avocado","Fruit",68,"g",114,1.3,6.0,10.5,{"fibre_g":4.6,"potassium_mg":345},[o("1/2",68,True),o("1 whole",136),o("100g",100)])
add("Pomegranate","Fruit",174,"g",144,2.9,32.5,2.0,{"fibre_g":7.0},[o("1 cup",174,True),o("100g",100)])
add("Guava","Fruit",55,"g",37,1.4,7.9,0.5,{"vitamin_c_mg":125.6},[o("1 fruit",55,True),o("100g",100)])
add("Cherries","Fruit",138,"g",87,1.5,22.1,0.3,None,[o("1 cup",138,True),o("100g",100)])
add("Grapefruit","Fruit",123,"g",52,0.9,13.1,0.2,{"vitamin_c_mg":38.4},[o("1/2",123,True),o("100g",100)])
add("Raspberries","Fruit",123,"g",64,1.5,14.7,0.8,{"fibre_g":8.0},[o("1 cup",123,True),o("100g",100)])
add("Cantaloupe","Fruit",177,"g",60,1.5,14.4,0.3,{"vitamin_a_mcg":299},[o("1 cup",177,True),o("100g",100)])
add("Dates","Fruit",24,"g",66,0.4,18.0,0.0,{"potassium_mg":167},[o("1 date",24,True),o("3 dates",72)])
add("Coconut","Fruit",80,"g",283,2.7,12.2,26.8,{"fibre_g":7.2},[o("1 cup",80,True),o("100g",100)])
add("Blackberries","Fruit",144,"g",62,2.0,13.8,0.7,{"fibre_g":7.6},[o("1 cup",144,True),o("100g",100)])
add("Plum","Fruit",66,"g",30,0.5,7.5,0.2,None,[o("1 medium",66,True),o("100g",100)])
add("Dragon Fruit","Fruit",100,"g",60,1.2,13.0,0.4,{"fibre_g":3.0},[o("100g",100,True)])
add("Tangerine","Fruit",88,"g",47,0.7,11.7,0.3,{"vitamin_c_mg":23.5},[o("1 medium",88,True),o("100g",100)])
add("Lemon","Fruit",58,"g",17,0.6,5.4,0.2,{"vitamin_c_mg":30.7},[o("1 fruit",58,True)])
add("Cranberries","Fruit",100,"g",46,0.5,12.2,0.1,{"fibre_g":4.6},[o("1 cup",100,True)])

# VEGETABLES
add("Broccoli","Vegetable",91,"g",31,2.6,6.0,0.3,{"fibre_g":2.4,"vitamin_c_mg":81.2},[o("1 cup",91,True),o("100g",100)])
add("Spinach (raw)","Vegetable",30,"g",7,0.9,1.1,0.1,{"vitamin_a_mcg":141,"iron_mg":0.8},[o("1 cup",30,True),o("100g",100)])
add("Kale","Vegetable",67,"g",33,2.2,6.7,0.5,{"vitamin_c_mg":80.4},[o("1 cup",67,True),o("100g",100)])
add("Carrot","Vegetable",61,"g",25,0.6,5.8,0.1,{"vitamin_a_mcg":509},[o("1 medium",61,True),o("1 cup",128),o("100g",100)])
add("Tomato","Vegetable",123,"g",22,1.1,4.8,0.2,{"vitamin_c_mg":16.9,"potassium_mg":292},[o("1 medium",123,True),o("100g",100)])
add("Cucumber","Vegetable",301,"g",45,2.0,11.0,0.3,None,[o("1 whole",301,True),o("1 cup",119),o("100g",100)])
add("Bell Pepper (Red)","Vegetable",119,"g",37,1.2,7.2,0.4,{"vitamin_c_mg":152.0},[o("1 medium",119,True),o("100g",100)])
add("Onion","Vegetable",110,"g",44,1.2,10.3,0.1,None,[o("1 medium",110,True),o("100g",100)])
add("Potato (baked)","Vegetable",173,"g",161,4.3,36.6,0.2,{"potassium_mg":926,"fibre_g":3.8},[o("1 medium",173,True),o("100g",100)])
add("Sweet Potato","Vegetable",114,"g",103,2.3,23.6,0.1,{"vitamin_a_mcg":1096},[o("1 medium",114,True),o("100g",100)])
add("Cauliflower","Vegetable",107,"g",27,2.1,5.3,0.3,{"vitamin_c_mg":51.6},[o("1 cup",107,True),o("100g",100)])
add("Zucchini","Vegetable",113,"g",19,1.4,3.5,0.4,None,[o("1 medium",113,True),o("100g",100)])
add("Mushroom (White)","Vegetable",70,"g",15,2.2,2.3,0.2,{"selenium_mcg":6.5},[o("1 cup",70,True),o("100g",100)])
add("Lettuce (Romaine)","Vegetable",47,"g",8,0.6,1.5,0.1,{"vitamin_a_mcg":205},[o("1 cup",47,True),o("100g",100)])
add("Cabbage","Vegetable",89,"g",22,1.1,5.2,0.1,{"vitamin_c_mg":32.6},[o("1 cup",89,True),o("100g",100)])
add("Celery","Vegetable",101,"g",16,0.7,3.0,0.2,{"potassium_mg":263},[o("1 cup",101,True),o("100g",100)])
add("Asparagus","Vegetable",134,"g",27,2.9,5.2,0.2,{"folate_mcg":70},[o("1 cup",134,True),o("100g",100)])
add("Green Beans","Vegetable",125,"g",34,2.0,7.8,0.1,{"fibre_g":3.4},[o("1 cup",125,True),o("100g",100)])
add("Peas","Vegetable",145,"g",117,7.9,21.0,0.6,{"fibre_g":8.8},[o("1 cup",145,True),o("100g",100)])
add("Corn","Vegetable",154,"g",132,5.1,29.3,1.8,{"fibre_g":3.6},[o("1 cup",154,True),o("1 ear",90),o("100g",100)])
add("Beetroot","Vegetable",136,"g",58,2.2,13.0,0.2,{"folate_mcg":148},[o("1 cup",136,True),o("100g",100)])
add("Pumpkin","Vegetable",116,"g",30,1.2,7.5,0.1,{"vitamin_a_mcg":245},[o("1 cup",116,True),o("100g",100)])
add("Brussels Sprouts","Vegetable",88,"g",38,3.0,7.9,0.3,{"vitamin_c_mg":74.8},[o("1 cup",88,True),o("100g",100)])
add("Edamame","Vegetable",155,"g",188,18.5,13.8,8.1,{"fibre_g":8.1},[o("1 cup",155,True),o("100g",100)])
add("Eggplant","Vegetable",82,"g",20,0.8,4.8,0.2,{"fibre_g":2.5},[o("1 cup",82,True),o("100g",100)])
add("Garlic","Vegetable",3,"g",4,0.2,1.0,0.0,None,[o("1 clove",3,True),o("3 cloves",9)])
add("Okra","Vegetable",100,"g",33,1.9,7.5,0.2,{"fibre_g":3.2},[o("1 cup",100,True)])

# PROTEINS
add("Chicken Breast","Protein",140,"g",231,43.4,0.0,5.0,None,[o("1 breast",140,True),o("100g",100)])
add("Chicken Thigh","Protein",116,"g",229,28.3,0.0,12.1,None,[o("1 thigh",116,True),o("100g",100)])
add("Turkey Breast","Protein",140,"g",189,40.6,0.0,2.0,None,[o("1 serving",140,True),o("100g",100)])
add("Ground Beef (lean)","Protein",112,"g",196,28.6,0.0,8.4,{"zinc_mg":5.7,"iron_mg":2.7},[o("4 oz",112,True),o("100g",100)])
add("Ground Beef (regular)","Protein",112,"g",287,25.6,0.0,19.6,{"iron_mg":2.5},[o("4 oz",112,True),o("100g",100)])
add("Beef Sirloin","Protein",85,"g",177,26.1,0.0,7.6,{"zinc_mg":4.5,"iron_mg":1.6},[o("3 oz",85,True),o("100g",100)])
add("Pork Tenderloin","Protein",85,"g",120,22.2,0.0,3.0,{"thiamin_mg":0.8},[o("3 oz",85,True),o("100g",100)])
add("Bacon","Protein",8,"g",43,3.0,0.1,3.3,{"sodium_mg":137},[o("1 slice",8,True),o("3 slices",24)])
add("Salmon","Protein",85,"g",175,18.8,0.0,10.5,{"omega_3_g":1.8,"vitamin_d_mcg":11.1},[o("3 oz",85,True),o("6 oz",170),o("100g",100)])
add("Tuna (canned)","Protein",85,"g",73,16.5,0.0,0.6,{"selenium_mcg":56.0},[o("3 oz",85,True),o("1 can",142),o("100g",100)])
add("Shrimp","Protein",85,"g",84,20.4,0.0,0.2,None,[o("3 oz",85,True),o("100g",100)])
add("Cod","Protein",85,"g",70,15.1,0.0,0.6,None,[o("3 oz",85,True),o("100g",100)])
add("Tilapia","Protein",87,"g",109,22.8,0.0,2.3,None,[o("1 fillet",87,True),o("100g",100)])
add("Sardines","Protein",92,"g",208,24.6,0.0,11.4,{"calcium_mg":351,"omega_3_g":1.4},[o("1 can",92,True),o("100g",100)])
add("Eggs","Protein",50,"g",72,6.3,0.4,4.8,{"vitamin_d_mcg":1.0},[o("1 large",50,True),o("2 eggs",100),o("100g",100)])
add("Egg Whites","Protein",33,"g",17,3.6,0.2,0.1,None,[o("1 white",33,True),o("3 whites",99)])
add("Tofu (firm)","Protein",126,"g",88,10.1,2.2,5.3,{"calcium_mg":253,"iron_mg":1.8},[o("1/2 cup",126,True),o("100g",100)])
add("Tempeh","Protein",84,"g",162,15.4,9.4,9.0,None,[o("3 oz",84,True),o("100g",100)])
add("Lentils (cooked)","Protein",198,"g",230,17.9,39.9,0.8,{"fibre_g":15.6,"iron_mg":6.6},[o("1 cup",198,True),o("100g",100)])
add("Chickpeas (cooked)","Protein",164,"g",269,14.5,45.0,4.2,{"fibre_g":12.5,"iron_mg":4.7},[o("1 cup",164,True),o("100g",100)])
add("Black Beans (cooked)","Protein",172,"g",227,15.2,40.8,0.9,{"fibre_g":15.0},[o("1 cup",172,True),o("100g",100)])
add("Greek Yogurt","Protein",170,"g",100,17.3,6.1,0.7,{"calcium_mg":187},[o("1 cup",170,True),o("100g",100)])
add("Cottage Cheese","Protein",113,"g",81,14.0,3.2,1.2,{"calcium_mg":69},[o("1/2 cup",113,True),o("100g",100)])
add("Whey Protein","Protein",30,"g",113,25.0,2.0,0.5,None,[o("1 scoop",30,True),o("2 scoops",60)])
add("Peanut Butter","Protein",32,"g",188,8.0,6.0,16.0,{"fibre_g":1.9,"magnesium_mg":49},[o("2 tbsp",32,True),o("1 tbsp",16)])
add("Almond Butter","Protein",32,"g",196,6.8,6.0,17.8,{"magnesium_mg":89},[o("2 tbsp",32,True),o("1 tbsp",16)])
add("Chia Seeds","Protein",28,"g",138,4.7,12.0,8.7,{"fibre_g":9.8,"omega_3_g":5.0},[o("2 tbsp",28,True),o("100g",100)])
add("Paneer","Protein",100,"g",265,18.3,1.2,20.8,{"calcium_mg":480},[o("100g",100,True),o("50g",50)],rg="Indian",src="verified")
# GRAINS
add("White Rice (cooked)","Grain",158,"g",206,4.3,44.5,0.4,None,[o("1 cup",158,True),o("100g",100)])
add("Brown Rice (cooked)","Grain",195,"g",216,5.0,44.8,1.8,{"fibre_g":3.5},[o("1 cup",195,True),o("100g",100)])
add("Quinoa (cooked)","Grain",185,"g",222,8.1,39.4,3.6,{"fibre_g":5.2,"iron_mg":2.8},[o("1 cup",185,True),o("100g",100)])
add("Oats (dry)","Grain",40,"g",150,5.3,27.0,2.6,{"fibre_g":4.0},[o("1/2 cup",40,True),o("1 cup",80),o("100g",100)])
add("Whole Wheat Bread","Grain",28,"g",69,3.6,11.6,1.2,{"fibre_g":1.9},[o("1 slice",28,True),o("2 slices",56)])
add("White Bread","Grain",25,"g",67,1.9,12.7,0.8,None,[o("1 slice",25,True),o("2 slices",50)])
add("Pasta (cooked)","Grain",140,"g",220,8.1,43.2,1.3,None,[o("1 cup",140,True),o("100g",100)])
add("Tortilla (flour)","Grain",45,"g",140,3.6,23.6,3.5,None,[o("1 medium",45,True),o("1 large",64)])
add("Bagel","Grain",105,"g",270,10.0,53.0,1.6,{"iron_mg":3.8},[o("1 bagel",105,True),o("100g",100)])
add("Granola","Grain",55,"g",260,6.0,33.0,12.0,{"fibre_g":3.5},[o("1/2 cup",55,True),o("100g",100)])
add("Basmati Rice","Grain",163,"g",210,4.4,45.6,0.5,None,[o("1 cup",163,True),o("100g",100)],rg="Indian",src="verified")

# DAIRY
add("Whole Milk","Dairy",244,"ml",149,8.0,11.7,7.9,{"calcium_mg":276},[o("1 cup",244,True),o("100ml",100)])
add("Skim Milk","Dairy",245,"ml",83,8.3,12.2,0.2,{"calcium_mg":299},[o("1 cup",245,True),o("100ml",100)])
add("Cheddar Cheese","Dairy",28,"g",113,7.0,0.4,9.3,{"calcium_mg":200},[o("1 oz",28,True),o("100g",100)])
add("Mozzarella","Dairy",28,"g",85,6.3,0.7,6.3,{"calcium_mg":143},[o("1 oz",28,True),o("100g",100)])
add("Butter","Dairy",14,"g",102,0.1,0.0,11.5,None,[o("1 tbsp",14,True),o("1 pat",5)])
add("Almond Milk","Dairy",240,"ml",30,1.0,1.0,2.5,{"calcium_mg":451},[o("1 cup",240,True),o("100ml",100)])
add("Oat Milk","Dairy",240,"ml",120,3.0,16.0,5.0,{"calcium_mg":350},[o("1 cup",240,True),o("100ml",100)])
add("Yogurt (plain)","Dairy",245,"g",149,8.5,11.4,8.0,{"calcium_mg":296},[o("1 cup",245,True),o("100g",100)])
add("Ghee","Dairy",14,"g",123,0.0,0.0,14.0,None,[o("1 tbsp",14,True),o("100g",100)],rg="Indian",src="verified")
add("Feta Cheese","Dairy",28,"g",75,4.0,1.2,6.0,{"calcium_mg":140},[o("1 oz",28,True),o("100g",100)])
add("Heavy Cream","Dairy",15,"ml",51,0.3,0.4,5.4,None,[o("1 tbsp",15,True),o("100ml",100)])
# NUTS
add("Almonds","Nuts",28,"g",164,6.0,6.1,14.2,{"fibre_g":3.5,"magnesium_mg":76},[o("1 oz",28,True),o("100g",100)])
add("Walnuts","Nuts",28,"g",185,4.3,3.9,18.5,{"omega_3_g":2.6},[o("1 oz",28,True),o("100g",100)])
add("Cashews","Nuts",28,"g",157,5.2,8.6,12.4,{"magnesium_mg":83},[o("1 oz",28,True),o("100g",100)])
add("Peanuts","Nuts",28,"g",161,7.3,4.6,14.0,None,[o("1 oz",28,True),o("100g",100)])
add("Pistachios","Nuts",28,"g",159,5.7,7.7,12.9,None,[o("1 oz",28,True),o("100g",100)])
add("Sunflower Seeds","Nuts",28,"g",165,5.5,6.5,14.0,{"vitamin_e_mg":7.4},[o("1 oz",28,True),o("100g",100)])
add("Pumpkin Seeds","Nuts",28,"g",151,7.0,5.0,13.0,{"magnesium_mg":150},[o("1 oz",28,True),o("100g",100)])
add("Flax Seeds","Nuts",10,"g",55,1.9,3.0,4.3,{"fibre_g":2.8,"omega_3_g":2.4},[o("1 tbsp",10,True),o("100g",100)])
add("Tahini","Nuts",15,"g",89,2.6,3.2,8.0,{"calcium_mg":64},[o("1 tbsp",15,True),o("2 tbsp",30)])
add("Mixed Nuts","Nuts",28,"g",172,5.0,7.0,15.0,None,[o("1 oz",28,True),o("100g",100)])
# OILS
add("Olive Oil","Oil",14,"ml",119,0.0,0.0,13.5,None,[o("1 tbsp",14,True),o("1 tsp",5)])
add("Coconut Oil","Oil",14,"ml",121,0.0,0.0,13.5,None,[o("1 tbsp",14,True),o("1 tsp",5)])
add("Avocado Oil","Oil",14,"ml",124,0.0,0.0,14.0,None,[o("1 tbsp",14,True)])
add("Sesame Oil","Oil",14,"ml",120,0.0,0.0,13.6,None,[o("1 tbsp",14,True)])
# BEVERAGES
add("Coffee (black)","Beverage",237,"ml",2,0.3,0.0,0.0,{"potassium_mg":116},[o("1 cup",237,True),o("100ml",100)])
add("Green Tea","Beverage",237,"ml",2,0.5,0.0,0.0,None,[o("1 cup",237,True)])
add("Orange Juice","Beverage",248,"ml",112,1.7,25.8,0.5,{"vitamin_c_mg":124},[o("1 cup",248,True),o("100ml",100)])
add("Apple Juice","Beverage",248,"ml",114,0.3,28.0,0.3,{"potassium_mg":250},[o("1 cup",248,True),o("100ml",100)])
add("Coconut Water","Beverage",240,"ml",46,1.7,8.9,0.5,{"potassium_mg":600},[o("1 cup",240,True),o("100ml",100)])
# SNACKS
add("Dark Chocolate","Snack",28,"g",170,2.2,13.0,12.0,{"iron_mg":3.4,"magnesium_mg":64},[o("1 oz",28,True),o("100g",100)])
add("Popcorn (air-popped)","Snack",28,"g",110,3.1,22.1,1.3,{"fibre_g":3.6},[o("3 cups",28,True),o("100g",100)])
add("Hummus","Snack",30,"g",52,2.4,4.6,3.0,{"fibre_g":1.5},[o("2 tbsp",30,True),o("1/4 cup",62)])
add("Protein Bar","Snack",60,"g",210,20.0,22.0,7.0,None,[o("1 bar",60,True)])
add("Raisins","Snack",28,"g",85,0.9,22.5,0.1,{"potassium_mg":212},[o("1 oz",28,True),o("100g",100)])
add("Pancakes","Snack",77,"g",175,4.8,22.2,7.4,None,[o("1 medium",77,True),o("2 pancakes",154)])
add("Overnight Oats","Snack",245,"g",307,11.0,51.0,7.0,{"fibre_g":5.0},[o("1 cup",245,True)])
# INTERNATIONAL
add("Sushi Rice","International",186,"g",242,4.4,53.4,0.4,None,[o("1 cup",186,True),o("100g",100)],rg="Japanese")
add("Miso Soup","International",240,"ml",40,3.0,5.0,1.0,None,[o("1 cup",240,True)],rg="Japanese")
add("Kimchi","International",150,"g",23,1.6,4.0,0.5,{"fibre_g":2.4},[o("1 cup",150,True),o("100g",100)],rg="Korean")
add("Falafel","International",17,"g",57,2.3,5.4,3.4,None,[o("1 piece",17,True),o("4 pieces",68)],rg="Middle Eastern")
add("Pad Thai","International",275,"g",400,15.0,55.0,14.0,None,[o("1 serving",275,True)],rg="Thai")
add("Biryani","International",250,"g",400,22.0,50.0,12.0,None,[o("1 serving",250,True),o("100g",100)],rg="Indian",src="verified")
add("Dal","International",200,"g",180,10.0,28.0,3.0,{"fibre_g":6.0,"iron_mg":3.0},[o("1 cup",200,True),o("100g",100)],rg="Indian",src="verified")
add("Butter Chicken","International",250,"g",438,28.0,12.0,30.0,None,[o("1 serving",250,True),o("100g",100)],rg="Indian",src="verified")
add("Chole","International",200,"g",240,10.0,32.0,8.0,{"fibre_g":8.0},[o("1 cup",200,True),o("100g",100)],rg="Indian",src="verified")
add("Idli","International",40,"g",39,2.0,8.0,0.2,None,[o("1 piece",40,True),o("3 pieces",120)],rg="Indian",src="verified")
add("Dosa","International",100,"g",168,4.0,28.0,4.0,None,[o("1 dosa",100,True),o("2 dosas",200)],rg="Indian",src="verified")
add("Samosa","International",100,"g",262,5.0,28.0,14.0,None,[o("1 piece",100,True),o("2 pieces",200)],rg="Indian",src="verified")
add("Jollof Rice","International",175,"g",260,5.0,42.0,8.0,None,[o("1 cup",175,True),o("100g",100)],rg="West African")
add("Injera","International",100,"g",145,5.0,28.0,1.0,{"iron_mg":3.0},[o("1 piece",100,True)],rg="Ethiopian")

# Write the file
import json
with open("src/modules/food_database/global_seed_data.py", "w") as f:
    f.write(HEADER)
    # Convert JSON to valid Python (true→True, false→False, null→None)
    text = json.dumps(items, indent=2)
    text = text.replace(": true", ": True").replace(": false", ": False").replace(": null", ": None")
    f.write(text)
    f.write("\n")

print(f"Wrote {len(items)} food items to global_seed_data.py")
