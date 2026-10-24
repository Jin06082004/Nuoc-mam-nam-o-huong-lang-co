USE nam_o_fish_sauce;

INSERT INTO social_links (platform, name, url, icon, is_active, sort_order)
VALUES (
    'FACEBOOK',
    'Facebook',
    'https://www.facebook.com/share/18aqjfUGiy/?mibextid=wwXIfr',
    'facebook',
    TRUE,
    0
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    url = VALUES(url),
    icon = VALUES(icon),
    is_active = VALUES(is_active),
    sort_order = VALUES(sort_order);
