###AES加密算法
对称式加密。
分组密码有五种工作体制：
1. 电码本模式（Electronic Codebook Book (ECB)）；这种模式是将整个明文分成若干段相同的小段，然后对每一小段进行加密。
2. 密码分组链接模式（Cipher Block Chaining (CBC)）；这种模式是先将明文切分成若干小段，然后每一小段与初始块或者上一段的密文段进行异或运算后，再与密钥进行加密。
3. 计算器模式（Counter (CTR)）；
4. 密码反馈模式（Cipher FeedBack (CFB)）；
5. 输出反馈模式（Output FeedBack (OFB)）。



显示本地openssl支持的加密算法：
openssl list-ciper-algorithms






