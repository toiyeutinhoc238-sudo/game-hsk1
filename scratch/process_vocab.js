const fs = require('fs');

let rawData = `
1	15	大兴机场见！	爱	Động từ	ài	yêu, thích	3. Cảm xúc & Thái độ	
2	4	我有兩個孩子	八	Số từ	bā	tám	14. Số lượng & Đo lường	
3	4	我有两个孩子	爸爸	Danh từ	bàba	bố	1. Con người & Các mối quan hệ	
4	7	我晚上六点半下班	吧	Trợ từ	ba	"nào; nhé; chứ; thôi; đi
"	15. Công cụ ngữ pháp & Cấu trúc	
5	9	我明天上午 ở trường học tập	白天	Danh từ	báitiān	ban ngày	10. Thời gian	
6	4	我有两个孩子	百	Số từ	bǎi	Một trăm	14. Số lượng & Đo lường	
7	7	我晚上六点半下班	半	Số từ	bàn	Một nửa	14. Số lượng & Đo lường:	
8	6	你的手机号码是多少	包子	Danh từ	bāozi	bánh bao hấp nhân	17. Đồ ăn & Thức uống	
9	13	请給我一杯茶	杯	Lượng từ, Danh từ	bēi	ly; cốc	6. Đồ vật & Công cụ	
10	10	这儿的苹果真便宜	杯子	Danh từ	bēizi	 ly; cốc; chén; tách	6. Đồ vật & Công cụ	
11	9	我明天上午 ở trường học tập	本	Lượng từ	běn	vở; tập; cuốn; quyển (dùng cho sách vở sổ sách)	14. Số lượng & Đo lường	
12	9	我明天上午 ở trường học tập	边	Danh từ, Hậu tố	biān	bên	9. Không gian & Vị trí	
13	12	昨天下雪了	病	Động từ	bìng	đau ốm	2. Cơ thể & Sức khỏe	
14	8	我爸爸也在医院工作	病人	Danh từ	bìngrén	bệnh nhân	2. Cơ thể & Sức khỏe	
15	1	AI 小语，你好！	不客气		bú kèqi	Không có gì	15. Công cụ ngữ pháp & Cấu trúc	
16	14	我看了一個电影	不要	Phó từ	búyào	không muốn	15. Công cụ ngữ pháp & Cấu trúc	
17	2	我叫李文	不	Phó từ	bù	KHÔNG	15. Công cụ ngữ pháp & Cấu trúc	
18	5,7	"今天我休息
我晚上六点半下班"	菜	Danh từ	cài	món ăn	17. Đồ ăn & Thức uống	
19	13	请給我一杯茶	茶	Danh từ	chá	Trà	17. Đồ ăn & Thức uống	
20	9	我明天上午 ở trường học tập	唱	Động từ	chàng	Hát	5. Đời sống sinh hoạt	
21	6	你的手机号码是多少	超市	Danh từ	chāoshì	siêu thị	7. Địa điểm & Nơi chốn	
22	11	我读大学了	车	Danh từ	chē	xe hơi	8. Giao thông & Di chuyển	
23	6	你的手机号码是多少	吃	Động từ	chī	ăn	5. Đời sống sinh hoạt	
24	6	你的手机号码是多少	出租车	Danh từ	chūzūchē	Taxi	8. Giao thông & Di chuyển	
25	10	这儿的苹果真便宜	穿	Động từ	chuān	mặc	5. Đời sống sinh hoạt	
26	13	请給我一杯茶	打电话	Động từ	dǎ diànhuà	Gọi điện	5. Đời sống sinh hoạt	
27	4,8	"我有两个孩子
我爸爸也在医院工作"	大	Tính từ	dà	to lớn	13. Miêu tả & Đánh giá	
28	1	AI 小语，你好！	大家	Đại từ	dàjiā	Mọi người	1. Con người & Các mối quan hệ	
29	11	我读大学了	大学	Danh từ	dàxué	Trường đại học	7. Địa điểm & Nơi chốn	
30	11	我读大学了	大学生	Danh từ	dàxuéshēng	sinh viên đại học	12. Công việc & Nghề nghiệp	
31	8	我爸爸也在医院工作	到	Động từ	dào	đến	8. Giao thông & Di chuyển	
32	3	我是中国人	的	Trợ từ	de	của	15. Công cụ ngữ pháp & Cấu trúc	
33	11	我读大学了	弟弟	Danh từ	dìdi	em trai	1. Con người & Các mối quan hệ	
34	9	我明天上午 ở trường học tập	第	Tiền tố	dì	(tiền tố) đứng trước số thứ tự	14. Số lượng & Đo lường	
35	7	我晚上六点半下班	点	Lượng từ	diǎn	giờ	10. Thời gian	
36	6	你的手机号码是多少	电话	Danh từ	diànhuà	Điện thoại	6. Đồ vật & Công cụ	
37	5	今天我休息	电脑	Danh từ	diànnǎo	máy tính	6. Đồ vật & Công cụ	
38	9	我明天上午 ở trường học tập	电视	Danh từ	diànshì	tivi	6. Đồ vật & Công cụ	
39	7	我晚上六点半下班	电影	Danh từ	diànyǐng	Bộ phim	6. Đồ vật & Công cụ:	
40	7	我晚上六点半下班	电影院	Danh từ	diànyǐngyuàn	Rạp chiếu phim	7. Địa điểm & Nơi chốn	
41	7	我晚上六点半下班	店	Danh từ	diàn	cửa hàng	7. Địa điểm & Nơi chốn	
42	6	你的手机号码是多少	东西	Danh từ	dōngxi	điều	6. Đồ vật & Công cụ	
43	14	我看了一個电影	都	Phó từ	dōu	Tất cả	15. Công cụ ngữ pháp & Cấu trúc	
44	11	我读大学了	读	Động từ	dú	đọc, đi học	4. Tư duy & Nhận thức	
45	9	我明天上午 ở trường học tập	读书	Động từ	dúshū	đọc	4. Tư duy & Nhận thức	
46	3,11	"我是中国人
我读大学了"	对	Tính từ, Giới từ	duì	"tính từ - đúng, phải
giới từ - đối với..."	13. Miêu tả & Đánh giá	
47	2	我叫李文	对不起	Động từ	duìbuqǐ	Xin lỗi	15. Công cụ ngữ pháp & Cấu trúc	
48	4,8	"我有两个孩子
我爸爸也在医院工作"	多	Đại từ	duō	nhiều	13. Miêu tả & Đánh giá	
49	4	我有兩個孩子	多少	Đại từ	duōshao	Bao nhiêu	14. Số lượng & Đo lường	
50	4	我有两个孩子	儿子	Danh từ	érzi	con trai	1. Con người & Các mối quan hệ	
51	4	我有两个孩子	二	Số từ	èr	hai	14. Số lượng & Đo lường	
52	8	我爸爸也在医院工作	饭	Danh từ	fàn	bữa ăn	17. Đồ ăn & Thức uống	
53	11	我读大学了	饭店	Danh từ	fàndiàn	Nhà hàng	7. Địa điểm & Nơi chốn	
54	8	我爸爸也在医院工作	房间	Danh từ	fángjiān	Phòng	7. Địa điểm & Nơi chốn	
55	15	大兴机场见！	飞机	Danh từ	fēijī	máy bay	8. Giao thông & Di chuyển	
56	6	你的手机号码是多少	非常	Phó từ	fēicháng	Rất	13. Miêu tả & Đánh giá	
57	7	我晚上六点半下班	分	Lượng từ	fēn	lượng từ dành cho phút	10. Thời gian	
58	7	我晚上六点半下班	分钟	Lượng từ	fēnzhōng	phút	10. Thời gian	
59	13	请給我一杯茶	服务员	Danh từ	fúwùyuán	phục vụ nam	12. Công việc & Nghề nghiệp	
60	2	我叫李文	高兴	Tính từ	gāoxìng	Vui mừng	3. Cảm xúc & Thái độ	
61	4	我有两个孩子	哥哥	Danh từ	gēge	anh trai	1. Con người & Các mối quan hệ	
62	9	我明天上午 ở trường học tập	歌	Danh từ	gē	Bài hát	5. Đời sống sinh hoạt	
63	4	我有两个孩子	个	Lượng từ	gè	cái	14. Số lượng & Đo lường	
64	13	请給我一杯茶	给	Động từ	gěi	Đưa cho	5. Đời sống sinh hoạt	
65	3,8	"我是中国人
我爸爸也在医院工作"	工作	Danh từ	gōngzuò	Công việc	12. Công việc & Nghề nghiệp	
66	12	昨天下雪了	公司	Danh từ	gōngsī	công ty	7. Địa điểm & Nơi chốn	
67	9	我明天上午 ở trường học tập	狗	Danh từ	gǒu	chó	7. Địa điểm & Nơi chốn	
68	10	这儿的苹果真便宜	贵	Tính từ	guì	đắt	13. Miêu tả & Đánh giá	
69	3	我是中国人	国	Danh từ	guó	quốc gia	7. Địa điểm & Nơi chốn	
70	3	我是中国人	还	Phó từ	hái	vẫn	15. Công cụ ngữ pháp & Cấu trúc	
71	4	我有两个孩子	孩子	Danh từ	háizi	đứa trẻ	1. Con người & Các mối quan hệ	
72	1	AI 小语，你好！	好	Tính từ	hǎo	Tốt	13. Miêu tả & Đánh giá	
73	6	你的手机号码是多少	好吃	Tính từ	hǎochī	ngon	17. Đồ ăn & Thức uống	
74	5	今天我休息	好看	Tính từ	hǎokàn	Đẹp	13. Miêu tả & Đánh giá	
75	9	我明天上午 ở trường học tập	好听	Tính từ	hǎotīng	Nghe hay đấy.	13. Miêu tả & Đánh giá	
76	15	大兴机场见！	好玩儿	Tính từ	hǎowánr	Vui vẻ	13. Miêu tả & Đánh giá	
77	5,6	你的手机号码是多少	号	Lượng từ, Danh từ	hào	lượng từ: dùng cho ngày (ngày tháng)；danh từ: số	14. Số lượng & Đo lường	
78	12	昨天下雪了	喝	Động từ	hē	uống	5. Đời sống sinh hoạt	
79	4,9	我明天上午 ở trường học tập	和	Liên từ, Giới từ	hé	Và	15. Công cụ ngữ pháp & Cấu trúc	
80	2	我叫李文	很	Phó từ	hěn	rất	15. Công cụ ngữ pháp & Cấu trúc	
81	7	我晚上六点半下班	后	Danh từ	hòu	mặt sau	9. Không gian & Vị trí	
82	12	昨天下雪了	回	Động từ	huí	trở lại	8. Giao thông & Di chuyển	
83	5	今天我休息	会	Động từ năng nguyện	huì	biết	15. Công cụ ngữ pháp & Cấu trúc	
84	14	我看了一個电影	火车	Danh từ	huǒchē	xe lửa	8. Giao thông & Di chuyển	
85	15	大兴机场见！	机场	Danh từ	jīchǎng	Sân bay	7. Địa điểm & Nơi chốn	
86	13	请給我一杯茶	鸡蛋	Danh từ	jīdàn	trứng	17. Đồ ăn & Thức uống	
87	4,15	"我有两个孩子
大兴机场见！"	几	Đại từ, Số từ	jǐ	bao nhiêu; một vài	14. Số lượng & Đo lường	
88	4	我有两个孩子	家	Danh từ, Lượng từ	jiā	gia đình; lượng từ cho cửa hàng	7. Địa điểm & Nơi chốn	
89	15	大兴机场见！	家人	Danh từ	jiārén	gia đình	1. Con người & Các mối quan hệ	
90	7	我晚上六点半下班	见	Động từ	jiàn	Nhìn thấy	4. Tư duy & Nhận thức	
91	10	这儿的苹果真便宜	件	Lượng từ	jiàn	mảnh	6. Đồ vật & Công cụ	
92	5	今天我休息	饺子	Danh từ	jiǎozi	bánh bao	17. Đồ ăn & Thức uống	
93	2	我叫李文	叫	Động từ	jiào	Gọi	4. Tư duy & Nhận thức	
94	15	大兴机场见！	接	Động từ	jiē	tiếp đón, tiếp đãi	1. Con người & Các mối quan hệ	
95	3	我是中国人	姐姐	Danh từ	jiějie	chị gái	1. Con người & Các mối quan hệ	
96	10	这儿的苹果真便宜	斤	Lượng từ	jiàn	cân	14. Số lượng & Đo lường	
97	4	今年	Năm nay	jīnnián	Năm nay	10. Thời gian	
98	5	今天我休息	今天	Danh từ	jīntiān	Hôm nay	10. Thời gian	
99	4	我有两个孩子	九	Đại từ	jiǔ	Chín	14. Số lượng & Đo lường	
100	12	昨天下雪了	觉得	Động từ	juéde	cảm thấy	3. Cảm xúc & Thái độ	
101	14	我看了一個电影	开	Động từ	kāi	mở, khởi động	5. Đời sống sinh hoạt	
102	11	我读大学了	开车	Động từ	kāichē	lái xe	8. Giao thông & Di chuyển	
103	7	我晚上六点半下班	看	Động từ	kàn	Nhìn	4. Tư duy & Nhận thức	
104	12	昨天下雪了	看病	Động từ	kànbìng	đi khám bác sĩ	2. Cơ thể & Sức khỏe	
105	8	我爸爸也在医院工作	看见	Động từ	kànjiàn	nhìn thấy	4. Tư duy & Nhận thức	
106	13	请給我一杯茶	可以	Động từ năng nguyện	kěyǐ	Có thể	15. Công cụ ngữ pháp & Cấu trúc	
107	4	我有兩個孩子	口	Lượng từ	kǒu	người; thành viên	14. Số lượng & Đo lường	
108	10	这儿의苹果真便宜	块	Lượng từ	kuài	lượng từ dùng cho tiền giấy	14. Số lượng & Đo lường	
109	12	昨天下雪了	来	Động từ	lái	Đến	8. Giao thông & Di chuyển	
110	1	AI 小语，你好！	老师	Danh từ	lǎoshī	giáo viên	12. Công việc & Nghề nghiệp	
111	12,14	"我看了一個电影
昨天下雪了"	了	Trợ từ	le	Đã	15. Công cụ ngữ pháp & Cấu trúc	
112	12	昨天下雪了	冷	Tính từ	lěng	lạnh lẽo	13. Miêu tả & Đánh giá	
113	7	我晚上六点半下班	里	Danh từ	lǐ	bên trong	9. Không gian & Vị trí	
114	4	我有两个孩子	两	Số từ	liǎng	hai	14. Số lượng & Đo lường	
115	4	我有两个孩子	零	Số từ	líng	số không	14. Số lượng & Đo lường	
116	4	我有两个孩子	六	Số từ	liù	sáu	14. Số lượng & Đo lường	
117	4	我有兩個孩子	妈妈	Danh từ	māma	Mẹ	1. Con người & Các mối quan hệ	
118	3	我是中国人	吗	Trợ từ	ma	Ma	15. Công cụ ngữ pháp & Cấu trúc	
119	6	你的手机号码是多少	買	Động từ	mǎi	mua	5. Đời sống sinh hoạt	
120	13	请給我一杯茶	卖	Động từ	mài	Bán	5. Đời sống sinh hoạt	
121	3	我是中国人	忙	Tính từ	máng	bận	13. Miêu tả & Đánh giá	
122	8	我爸爸也在医院工作	猫	Danh từ	māo	con mèo	18.Động vật	
123	8	我爸爸也在医院工作	没	Phó từ	méi	không có	15. Công cụ ngữ pháp & Cấu trúc	
124	2	我叫李文	没关系		méi guānxi	Điều đó không quan trọng	15. Công cụ ngữ pháp & Cấu trúc	
125	2	我叫李文	没事	Động từ	méishì	không có gì	15. Công cụ ngữ pháp & Cấu trúc	
126	4	我有兩個孩子	没有	Động từ	méiyǒu	KHÔNG	15. Công cụ ngữ pháp & Cấu trúc	
127	4	我有两个孩子	妹妹	Danh từ	mèimei	em gái	1. Con người & Các mối quan hệ	
128	1	AI 小语，你好！	们	Hậu tố	men	Họ		
129	6	你的手机号码是多少	米饭	Danh từ	mǐfàn	cơm	17. Đồ ăn & Thức uống	
130	13	请給我一杯茶	面包	Danh từ	miànbāo	bánh mỳ		
131	5	今天我休息	面条儿	Danh từ	miàntiáor	mì	17. Đồ ăn & Thức uống	
132	2	我叫李文	名字	Danh từ	míngzi	tên	1. Con người & Các mối quan hệ	
133	14	我看了一個电影	明年	Danh từ	míngnián	năm tới	10. Thời gian	
134	6	你的手机号码是多少	明天	Danh từ	míngtiān	Ngày mai	10. Thời gian	
135	3	我是中国人	哪	Đại từ	nǎ	Ở đâu	7. Địa điểm & Nơi chốn	
136	15	大兴机场见！	哪个	Đại từ	nǎge	Cái mà		
137	11	我读大学了	哪里	Đại từ	nǎlǐ	Ở đâu	9. Không gian & Vị trí	
138	6	你的手机号码是多少	哪儿	Đại từ	nǎr	Ở đâu	7. Địa điểm & Nơi chốn	
139	14	我看了一個电影	哪些	Phó từ	nǎxiē	Cái mà		
140	9,15	"我明天上午 ở trường học tập
大兴机场见！"	那	Đại từ	nà	Cái đó	15. Công cụ ngữ pháp & Cấu trúc	
141	6	你的手机号码是多少	那边	Đại từ	nàbiān	ở đó	9. Không gian & Vị trí	
142	9	我明天上午 ở trường học tập	那个	Đại từ	nàge	cái đó	9. Không gian & Vị trí	
143	11	我读大学了	那里	Đại từ	nàlǐ	Ở đó	7. Địa điểm & Nơi chốn	
144	10	这儿的苹果真便宜	那儿	Đại từ	nàr	ở đó	7. Địa điểm & Nơi chốn	
145	10	这儿의苹果真便宜	那些	Đại từ	nàxiē	Những cái đó	15. Công cụ ngữ pháp & Cấu trúc	
146	10	这儿의苹果真便宜	男	Tính từ	nán	nam giới	1. Con người & Các mối quan hệ	
147	15	大兴机场见！	男朋友	Danh từ	nánpéngyou	Bạn trai	1. Con người & Các mối quan hệ	
148	4,7	"我有两个孩子
我晚上六点半下班"	呢	Trợ từ	ne	Trợ từ đặt cuối câu để khẳng định	15. Công cụ ngữ pháp & Cấu trúc	
149	8	我明天上午 ở trường học tập	能	Động từ năng nguyện	néng	có thể	15. Công cụ ngữ pháp & Cấu trúc	
150	2	我叫李文	你	Danh từ	nǐ	Bạn	1. Con người & Các mối quan hệ	
151	1	AI 小语，你好！	你好		nǐ hǎo	Xin chào	15. Công cụ ngữ pháp & Cấu trúc	
152	1	AI 小语，你好！	你们	Đại từ	nǐmen	Bạn	1. Con người & Các mối quan hệ	
153	15	大兴机场见！	年	Danh từ	nián	Năm	10. Thời gian	
154	1	AI 小语，你好！	您	Đại từ	nín	Bạn	1. Con người & Các mối quan hệ	
155	6	你的手机号码是多少	牛奶	Danh từ	niúnǎi	sữa	17. Đồ ăn & Thức uống	
156	10	这儿의苹果真便宜	女	Tính từ	nǚ	nữ giới	1. Con người & Các mối quan hệ	
157	4	我有两个孩子	女儿	Danh từ	nǚ’ér	con gái	1. Con người & Các mối quan hệ	
158	3	我是中国人	女朋友	Danh từ	nǚpéngyou	bạn gái	1. Con người & Các mối quan hệ	
159	13	请給我一杯茶	女士	Danh từ	nǚshì	Cô	1. Con người & Các mối quan hệ	
160	9	我明天上午 ở trường học tập	朋友	Danh từ	péngyou	bạn bè	1. Con người & Các mối quan hệ	
161	10	这儿的苹果真便宜	便宜	Tính từ	piányi	Rẻ	13. Miêu tả & Đánh giá	
162	8	我明天上午 ở trường học tập	漂亮	Tính từ	piàoliang	đẹp	13. Miêu tả & Đánh giá	
163	10	这儿의苹果真便宜	苹果	Danh từ	píngguǒ	quả táo	17. Đồ ăn & Thức uống	
164	4	我有两个孩子	七	Số từ	qī	bảy	14. Số lượng & Đo lường	
165	11	我读大学了	起床	Động từ	qǐchuáng	thức dậy	5. Đời sống sinh hoạt	
166	4	我有两个孩子	千	Số từ	qiān	nghìn	14. Số lượng & Đo lường	
167	8	我明天上午 ở trường học tập	前	Danh từ	qián	phía trước	9. Không gian & Vị trí	
168	9	我明天上午 ở trường học tập	前边	Danh từ	qiánbiān	đằng trước	9. Không gian & Vị trí	
169	10	这儿의苹果真便宜	钱	Danh từ	qián	tiền bạc	6. Đồ vật & Công cụ	
170	13	请給我一杯茶	请	Động từ	qǐng	Xin vui lòng	15. Công cụ ngữ pháp & Cấu trúc	
171	2	我叫李文	请问	Động từ	qǐngwèn	cho hỏi, xin hỏi	4. Tư duy & Nhận thức	
172	6	你的手机号码是多少	去	Động từ	qù	đi	8. Giao thông & Di chuyển	
173	15	大兴机场见！	去年	Danh từ	qùnián	năm ngoái	10. Thời gian	
174	12	昨天下雪了	热	Tính từ	rè	nóng	13. Miêu tả & Đánh giá	
175	3	我是中国人	人	Danh từ	rén	mọi người	1. Con người & Các mối quan hệ	
176	2	我叫李文	认识	Động từ	rènshi	biết	4. Tư duy & Nhận thức	
177	5	今天我休息	日	Lượng từ	rì	ngày	10. Thời gian	
178	4	我有兩個孩子	三	Số từ	sān	ba	14. Số lượng & Đo lường	
179	10	这儿의苹果真便宜	商店	Danh từ	shāngdiàn	cửa hàng	7. Địa điểm & Nơi chốn	
180	9,14	"我明天上午在学校学习
我看了一個电影"	上	Danh từ, Động từ	shàng	"danh từ - vị trí cao (trên bảng xếp hạng)
động từ - lên; bắt đầu làm gì đó ở mốc thời gian cố định"	9. Không gian & Vị trí	
181	7	我晚上六点半下班	上班	Động từ	shàngbān	công việc	12. Công việc & Nghề nghiệp	
182	7	我晚上六点半下班	上课	Động từ	shàngkè	Tham gia lớp học	12. Công việc & Nghề nghiệp	
183	7	我晚上六点半下班	上午	Danh từ	shàngwǔ	buổi sáng	10. Thời gian	
184	14	我看了一個电影	上学	Động từ	shàngxué	đi học	12. Công việc & Nghề nghiệp	
185	10	这儿의苹果真便宜	少	Tính từ	shǎo	một vài	13. Miêu tả & Đánh giá	
186	3	我是中国人	谁	Đại từ	shéi/shuí	Ai	1. Con người & Các mối quan hệ	
187	2	我叫李文	什么	Đại từ	shénme	Cái gì	15. Công cụ ngữ pháp & Cấu trúc	
188	12	昨天下雪了	生病	Động từ	shēngbìng	Bị ốm	2. Cơ thể & Sức khỏe	
189	4	我有两个孩子	十	Số từ	shí	mười	14. Số lượng & Đo lường	
190	11	我读大学了	时候	Danh từ	shíhou	khi	10. Thời gian	
191	15	大兴机场见！	时间	Danh từ	shíjiān	thời gian	10. Thời gian	
192	7	我晚上六点半下班	事	Danh từ	shì	điều	6. Đồ vật & Công cụ	
193	2	我叫李文	是	Động từ	shì	Đúng	15. Công cụ ngữ pháp & Cấu trúc	
194	6	你的手机号码是多少	手机	Danh từ	shǒujī	điện thoại di động	6. Đồ vật & Công cụ	
195	10	这儿의苹果真便宜	售货员	Danh từ	shòuhuòyuán	Nhân viên bán hàng	12. Công việc & Nghề nghiệp	
196	9	我明天上午 ở trường học tập	书	Danh từ	shū	Sách	6. Đồ vật & Công cụ	
197	8	我明天上午 ở trường học tập	书店	Danh từ	shūdiàn	hiệu sách	7. Địa điểm & Nơi chốn	
198	12	昨天下雪了	水	Danh từ	shuǐ	Nước	16. Tự nhiên	
199	10	控制ê의苹果真便宜	水果	Danh từ	shuǐguǒ	hoa quả	17. Đồ ăn & Thức uống	
200	11	睡	ngủ	shuì	ngủ	5. Đời sống sinh hoạt	
201	11	睡觉	ngủ	shuìjiào	ngủ	5. Đời sống sinh hoạt	
202	11	说	nói	shuō	nói	4. Tư duy & Nhận thức	
203	14	我看了一個电影	说话	Động từ	shuōhuà	nói	4. Tư duy & Nhận thức	
204	4	我有两个孩子	四	Số từ	sì	Bốn	14. Số lượng & Đo lường	
205	4	我有两个孩子	岁	Lượng từ	suì	tuổi	14. Số lượng & Đo lường	
206	4	我有两个孩子	他	Đại từ	tā	Anh ta	1. Con người & Các mối quan hệ	
207	14	我看了一個电影	他们	Đại từ	tāmen	họ	1. Con người & Các mối quan hệ	
208	5	今天我休息	它	Đại từ	tā	Nó	1. Con người & Các mối quan hệ	
209			它们	Đại từ	tāmen	họ	1. Con người & Các mối quan hệ	
210	14	我看了一個电影	她们	Đại từ	tāmen	họ	1. Con người & Các mối quan hệ	
211	3	我是中国人	太	Phó từ	tài	cũng vậy	15. Công cụ ngữ pháp & Cấu trúc	
212	12	昨天下雪了	天	Danh từ, Lượng từ	tiān	thời tiết, ngày	16. Tự nhiên	
213	12	昨天下雪了	天气	Danh từ	tiānqì	thời tiết	16. Tự nhiên	
214	14	我看了一個电影	听	Động từ	tīng	Nghe	4. Tư duy & Nhận thức	
215	14	我看了一個电影	听见	Động từ	tīngjiàn	nghe	4. Tư duy & Nhận thức	
216	1	AI 小语，你好！	同学	Danh từ	tóngxué	bạn cùng lớp	1. Con người & Các mối quan hệ	
217	8	我明天上午 ở trường học tập	外	Danh từ	wài	ngoài	9. Không gian & Vị trí	
218	9	我明天上午 ở trường học tập	外边	Danh từ	wàibiān	ngoài	9. Không gian & Vị trí:	
219	9	我明天上午 ở trường học tập	玩	Động từ	wán	Chơi	5. Đời sống sinh hoạt	
220	14	我看了一個电影	晚	Tính từ	wǎn	Đêm	10. Thời gian	
221	6	你的手机号码是多少	晚饭	Danh từ	wǎnfàn	bữa tối	17. Đồ ăn & Thức uống	
222	7	我晚上六点半下班	晚上	Danh từ	wǎnshang	đêm	10. Thời gian	
223	3	我是中国人	喂	Thán từ	wèi	Xin chào	15. Công cụ ngữ pháp & Cấu trúc	
224	11	我读大学了	问	Động từ	wèn	hỏi	4. Tư duy & Nhận thức	
225	13	请給我一杯茶	问题	Danh từ	wèntí	câu hỏi	4. Tư duy & Nhận thức	
226	2	我叫李文	我	Đại từ	wǒ	TÔI	1. Con người & Các mối quan hệ	
227	3	我是中国人	我们	Đại từ	wǒmen	chúng ta	1. Con người & Các mối quan hệ	
228	4	我有两个孩子	五	Số từ	wǔ	năm	14. Số lượng & Đo lường	
229	8	我明天上午 ở trường học tập	午饭	Danh từ	wǔfàn	bữa trưa	17. Đồ ăn & Thức uống	
230	5	今天我休息	喜欢	Động từ	xǐhuan	thích	3. Cảm xúc & Thái độ	
231	8,12	"我明天上午在学校学习
昨天下雪了"	下	Danh từ, Động từ	xià	"danh từ - vị trí thấp (trên bảng xếp hạng)
động từ - rơi"	9. Không gian & Vị trí	
232	5	今天我休息	下班	Động từ	xiàbān	tan ca làm việc		
233	7	我晚上六点半下班	下课	Động từ	xiàkè	Ra khỏi lớp học xong	12. Công việc & Nghề nghiệp	
234	7	我晚上六点半下班	下午	Danh từ	xiàwǔ	buổi chiều	10. Thời gian	
235	12	昨天下雪了	下雨		xiàyǔ	mưa	16. Tự nhiên	
236	13	请給我一杯茶	先生	Danh từ	xiānsheng	thưa quý ông	1. Con người & Các mối quan hệ	
237	7	我晚上六点半下班	现在	Danh từ	xiànzài	Hiện nay	10. Thời gian	
238	3,6	"我是中国人
你的手机号码是多少"	想	Động từ năng nguyện	xiǎng	nghĩ	4. Tư duy & Nhận thức	
239	8	我明天上午 ở trường học tập	小	Tính từ	xiǎo	Bé nhỏ	13. Miêu tả & Đánh giá	
240	11	我读大学了	小朋友	Danh từ	xiǎopéngyou	đứa trẻ	1. Con người & Các mối quan hệ:	
241	15	大兴机场见！	小时	Danh từ	xiǎoshí	Giờ	10. Thời gian	
242	14	我看了一個电影	小学	Danh từ	xiǎoxué	trường tiểu học	7. Địa điểm & Nơi chốn	
243	14	我看了一個电影	小学生	Danh từ	xiǎoxuéshēng	học sinh tiểu học	12. Công việc & Nghề nghiệp	
244	6	你的手机号码是多少	些	Lượng từ	xiē	một số	14. Số lượng & Đo lường	
245	14	我看了一個电影	写	Động từ	xiě	Viết	5. Đời sống sinh hoạt:	
246	1	AI 小语，你好！	谢谢	Động từ	xièxie	Cảm ơn	15. Công cụ ngữ pháp & Cấu trúc	
247	5	今天我休息	新	Tính từ	xīn	mới	13. Miêu tả & Đánh giá	
248	5	今天我休息	星期	Danh từ	xīngqī	Tuần	10. Thời gian	
249	5	今天我休息	星期日	Danh từ	xīngqīrì	Chủ nhật	10. Thời gian	
250	5	今天我休息	星期天	Danh từ	xīngqītiān	Chủ nhật	10. Thời gian	
251	5	今天我休息	休息	Động từ	xiūxi	nghỉ ngơi	5. Đời sống sinh hoạt	
252	11	我读大学了	学	Động từ	xué	học	4. Tư duy & Nhận thức	
253	1	AI 小语，你好！	学生	Danh từ	xuésheng	học sinh	12. Công việc & Nghề nghiệp	
254	9	我明天上午 ở trường học tập	学习	Động từ	xuéxí	học	4. Tư duy & Nhận thức	
255	8	我明天上午 ở trường học tập	学校	Danh từ	xuéxiào	Trường học	7. Địa điểm & Nơi chốn	
256	12	昨天下雪了	雪	Danh từ	xuě	Tuyết	16. Tự nhiên	
257	12	昨天下雪了	药	Danh từ	yào	thuốc	2. Cơ thể & Sức khỏe	
258	11,13,15	"大兴机场见！
请給我一杯茶
我读大学了"	要	Động từ năng nguyện	yào	muốn; cần, lấy	15. Công cụ ngữ pháp & Cấu trúc	
259	2	我叫李文	也	Phó từ	yě	Mà còn	15. Công cụ ngữ pháp & Cấu trúc	
260	4	我有两个孩子	一	Số từ	yī	một	14. Số lượng & Đo lường	
261	13	请給我一杯茶	一半	Số từ	yíbàn	một nửa	14. Số lượng & Đo lường	
262	13	请給我一杯茶	一下	Lượng từ, Số từ	yíxià	một lần	14. Số lượng & Đo lường	
263	12	昨天下雪了	一点儿	Số từ	yìdiǎnr	một chút	14. Số lượng & Đo lường	
264	5	今天我休息	一些	Số từ	yìxiē	Một số	14. Số lượng & Đo lường	
265	10	控制ê의苹果真便宜	衣服	Danh từ	yīfu	quần áo	6. Đồ vật & Công cụ	
266	11	我读大学了	医	Danh từ	yī	y học	12. Công việc & Nghề nghiệp	
267	8	我明天上午 ở trường học tập	医生	Danh từ	yīshēng	bác sĩ	12. Công việc & Nghề nghiệp	
268	7	我晚上六点半下班	医院	Danh từ	yīyuàn	Bệnh viện	7. Địa điểm & Nơi chốn	
269	9	我明天上午 ở trường học tập	椅子	Danh từ	yǐzi	Ghế	6. Đồ vật & Công cụ	
270	4	我有两个孩子	有	Động từ	yǒu	có	14. Số lượng & Đo lường	
271	14	我看了一個电影	有的	Đại từ	yǒude	một số	14. Số lượng & Đo lường	
272	12	昨天下雪了	有点儿	Phó từ	yǒudiǎnr	có chút hơi...	14. Số lượng & Đo lường	
273	14	我看了一個电影	有些	Đại từ	yǒuxiē	một số	14. Số lượng & Đo lường	
274	12	昨天下雪了	雨	Danh từ	yǔ	cơn mưa	16. Tự nhiên	
275	10	控制ê의苹果真便宜	元	Lượng từ	yuán	đơn vị tiền Nhân Dân Tệ	6. Đồ vật & Công cụ	
276	5	今天我休息	月	Danh từ	yuè	mặt trăng	10. Thời gian	
277	12,13	"请給我一杯茶
昨天下雪了"	再	Phó từ	zài	Lại	15. Công cụ ngữ pháp & Cấu trúc	
278	1	AI 小语，你好！	再见	Động từ	zàijiàn	tạm biệt	15. Công cụ ngữ pháp & Cấu trúc	
279	7,8,11	"我晚上六点半下班
我明天上午在学校学习
我读大学了"	在大	Động từ, Phó từ	zài	hiện hữu, đang diễn ra	15. Công cụ ngữ pháp & Cấu trúc	
280	15	大兴机场见！	早	Tính từ	zǎo	sớm	10. Thời gian	
281	13	请給我一杯茶	早饭	Danh từ	zǎofàn	bữa sáng	17. Đồ ăn & Thức uống	
282	7	我晚上六点半下班	早上	Danh từ	zǎoshang	Buổi sáng	16. Tự nhiên	
283	6	你的手机号码是多少	怎么	Đại từ	zěnme	Làm sao	15. Công cụ ngữ pháp & Cấu trúc	
284	10	控制ê의苹果真便宜	怎么样	Đại từ	zěnmeyàng	Thế nào?	15. Công cụ ngữ pháp & Cấu trúc	
285	11	我读大学了	找	Động từ	zhǎo	cố gắng tìm	5. Đời sống sinh hoạt	
286	3	我是中国人	中国		Zhōngguó 	Trung Quốc	7. Địa điểm & Nơi chốn	
287	3	我是中国人	法国		Fǎguó	Pháp	7. Địa điểm & Nơi chốn	
288	3	我是中国人	泰国		tàiguó	Thái Lan	7. Địa điểm & Nơi chốn	
289	3	我是中国人	中文		zhōngwén 	Tiếng Trung	6. Đồ vật & Công cụ	
290	3	我是中国人	她	Đại từ	tā 	cô ấy	1. Con người & Các mối quan hệ	
291	3	我是中国人	这	Đại từ	zhè	cái này	15. Công cụ ngữ pháp & Cấu trúc	
292	10	控制ê의苹果真便宜	这边	Đại từ	zhèbiān	Theo cách này	9. Không gian & Vị trí	
293	13	请給我一杯茶	这个	Đại từ	zhège	cái này	9. Không gian & Vị trí	
294	12	昨天下雪了	这里	Đại từ	zhèlǐ	đây	7. Địa điểm & Nơi chốn	
295	10	控制ê의苹果真便宜	这儿	Đại từ	zhèr	đây	7. Địa điểm & Nơi chốn	
296	10	控制ê의苹果真便宜	这些	Đại từ	zhèxiē	Những cái này	15. Công cụ ngữ pháp & Cấu trúc	
297	5	今天我休息	真	Phó từ	zhēn	thật, rất	13. Miêu tả & Đánh giá	
298	11	我读大学了	正在	Phó từ	zhèngzài	Đang tiến hành	13. Miêu tả & Đánh giá:	
299	8	我明天上午 ở trường học tập	只	Lượng từ	zhī 	lượng từ dùng cho con vật	14. Số lượng & Đo lường:	
300	11	我读大学了	知道	Động từ	zhīdào	biết, nhận ra	4. Tư duy & Nhận thức	
301	14	我看了一個电影	中午	Danh từ	zhōngwǔ	buổi trưa	10. Thời gian	
302	14	我看了一個电影	中学	Danh từ	zhōngxué	Trường trung học cơ sở	7. Địa điểm & Nơi chốn	
303	14	我看了一個电影	中学生	Danh từ	zhōngxuéshēng	học sinh trung học	12. Công việc & Nghề nghiệp	
304	15	大兴机场见！	住	Động từ	zhù	sống	5. Đời sống sinh hoạt	
305	15	大兴机场见！	西安		Xī'ān	Tây An	7. Địa điểm & Nơi chốn	
306	15	大兴机场见！	北京		Běijīng	Bắc Kinh	7. Địa điểm & Nơi chốn	
307	8	我明天上午 ở trường học tập	桌子	Danh từ	zhuōzi	bàn	6. Đồ vật & Công cụ	
308	14	我看了一個电影	字	Danh từ	zì	chữ cái	6. Đồ vật & Công cụ	
309	14	我看了一個电影	汉语	Danh từ	hànyǔ	Tiếng Trung	6. Đồ vật & Công cụ	
310	14	我看了一個电影	汉字	Danh từ	hànzì	Hán tự, chữ cái tiếng Trung	6. Đồ vật & Công cụ	
311	11	我读大学了	昨天	Danh từ	zuótiān	hôm qua	10. Thời gian	
312	6,13	"你的手机号码是多少
请給我一杯茶"	坐	Động từ	zuò	Ngồi	8. Giao thông & Di chuyển	
313	5,9	我明天上午 ở trường học tập	做	Động từ	zuò	Làm, tham gia	5. Đời sống sinh hoạt	
314	5	今天我休息	做饭		zuò fàn		5. Đời sống sinh hoạt	
`;

const MERGE_MAP = {
    "18.Động vật": "16. Tự nhiên",
    "bánh mỳ": "17. Đồ ăn & Thức uống",
    "Cái mà": "15. Công cụ ngữ pháp & Cấu trúc",
    "Họ": "1. Con người & Các mối quan hệ",
    "tan ca làm việc": "12. Công việc & Nghề nghiệp",
    "Các mối quan hệ": "1. Con người & Các mối quan hệ"
};

// Re-numbering map to fix the 10 -> 12 gap and make it 1-16
const RENUMBER_MAP = {
    "1. Con người & Các mối quan hệ": "1. Con người & Các mối quan hệ",
    "2. Cơ thể & Sức khỏe": "2. Cơ thể & Sức khỏe",
    "3. Cảm xúc & Thái độ": "3. Cảm xúc & Thái độ",
    "4. Tư duy & Nhận thức": "4. Tư duy & Nhận thức",
    "5. Đời sống sinh hoạt": "5. Đời sống sinh hoạt",
    "6. Đồ vật & Công cụ": "6. Đồ vật & Công cụ",
    "7. Địa điểm & Nơi chốn": "7. Địa điểm & Nơi chốn",
    "8. Giao thông & Di chuyển": "8. Giao thông & Di chuyển",
    "9. Không gian & Vị trí": "9. Không gian & Vị trí",
    "10. Thời gian": "10. Thời gian",
    "12. Công việc & Nghề nghiệp": "11. Công việc & Nghề nghiệp",
    "13. Miêu tả & Đánh giá": "12. Miêu tả & Đánh giá",
    "14. Số lượng & Đo lường": "13. Số lượng & Đo lường",
    "15. Công cụ ngữ pháp & Cấu trúc": "14. Công cụ ngữ pháp & Cấu trúc",
    "16. Tự nhiên": "15. Tự nhiên",
    "17. Đồ ăn & Thức uống": "16. Đồ ăn & Thức uống"
};

function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === '\t' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentCell.trim());
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }
    return rows;
}

const rows = parseCSV(rawData.trim());
const vocab = [];

for (const parts of rows) {
    if (parts.length < 5) continue;
    
    let item = null;
    if (parts.length >= 8) {
        item = {
            word: parts[3],
            type: parts[4],
            pinyin: parts[5],
            meaning: parts[6].replace(/\n/g, ' '),
            topic: parts[7]
        };
    } else if (parts.length >= 6) {
        const topic = parts[parts.length - 1];
        const meaning = parts[parts.length - 2].replace(/\n/g, ' ');
        const pinyin = parts[parts.length - 3];
        const type = parts[parts.length - 4];
        const word = parts[parts.length - 5];
        item = { word, type, pinyin, meaning, topic };
    }

    if (item && item.word && item.topic) {
        // Clean up topic name
        item.topic = item.topic.replace(/:$/, '').trim();
        
        // Merge topics with few items
        if (MERGE_MAP[item.topic]) {
            item.topic = MERGE_MAP[item.topic];
        }
        
        // Apply re-numbering
        if (RENUMBER_MAP[item.topic]) {
            item.topic = RENUMBER_MAP[item.topic];
        }
        
        vocab.push(item);
    }
}

const output = "const hsk1Vocab = " + JSON.stringify(vocab, null, 2) + ";";
fs.writeFileSync('c:/Users/BRAVO 15/Downloads/game tieng trung hsk 1/js/vocabulary_data.js', output);
console.log('Processed ' + vocab.length + ' items.');
const finalTopics = [...new Set(vocab.map(v => v.topic))].sort((a, b) => {
    const numA = parseInt(a.split('.')[0]);
    const numB = parseInt(b.split('.')[0]);
    return numA - numB;
});
console.log('Topics:', finalTopics.length);
finalTopics.forEach(t => console.log(t));
