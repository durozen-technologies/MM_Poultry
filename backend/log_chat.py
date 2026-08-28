import datetime
with open(r'd:\MMbroliers\.core\CHAT_LOG.md', 'a', encoding='utf-8') as f:
    f.write('\n### [' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '] Add Item Selection to Farm Purchase\n')
    f.write('- The user requested adding an item selection field to the farm purchase screen, making it strictly required.\n')
    f.write('- Added `item_id` to `FarmLoad` model and schemas, setting it to `nullable=False`.\n')
    f.write('- Created alembic migration `5028779dda41` which safely handles adding a non-nullable column to an existing table by first making it nullable, setting existing records to a default item, and then enforcing the constraint.\n')
    f.write('- Updated `AdminFarmPurchaseScreen` to fetch active items and provide a dropdown for item selection, mirroring the existing Farm dropdown.\n')

with open(r'd:\MMbroliers\.core\SESSION_HISTORY.md', 'a', encoding='utf-8') as f:
    f.write('\n### [' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '] Add Item Selection to Farm Purchase\n')
    f.write('- Implemented mandatory `item_id` selection in Farm Purchases (Backend Model, API Schemas, Migration, and UI).\n')
