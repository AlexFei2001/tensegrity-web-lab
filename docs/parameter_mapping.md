# GH → 网页参数映射

所有范围是 Slider 允许范围，不代表结构可行域。长度单位运行时待确认；不把 P 标成 N。

|GH source GUID|物理含义 / web control|unit|范围|保存值|export field|
|---|---|---|---|---|---|
|3c165de8-3ecd-47ab-9ae1-170a5e24ba4c|Bottom radius / 下层半径|model length|0.5–1.5|0.5|bottomRadius|
|d6ed47e3-d622-425d-82c8-3aefc982fb75|Top radius / 上层半径|model length|0.5–1.5|0.5|topRadius|
|2fbb51d4-b0f6-41a6-a43f-87e1b80eb4e8|Top elevation / 上层标高|model length|0–10|1.2|topZ|
|d6462d9e-d016-4567-bb05-dee269441377|Bottom elevation / 下层标高|model length|0–10|0|bottomZ|
|1b2ce418-de1a-4605-8f16-a7788d027ba3|Twist / 旋转角|deg|0–360|187.193|twist_deg|
|5b7f8d22-9ef1-4cec-a95b-22b9073ffd5a|Rest-length reduction / 静长缩短率|dimensionless|0–1|0.861|pretension_parameter|
|1cd6de1a-439a-4266-a4ff-0b6c938c0269|Load per node / 单点荷载|model force (uncalibrated)|0–1|0.571|loadPerNode|