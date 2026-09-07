import psycopg
conn = psycopg.connect('postgresql://postgres:root@localhost:5432/mmbroilers')
with conn.cursor() as cur:
    cur.execute('SET search_path TO tenant_demo, public')
    cur.execute('SELECT id, total_boxes, requested_kg FROM retailer_daily_order_items ORDER BY id DESC LIMIT 5')
    print(cur.fetchall())
