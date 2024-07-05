ORD(str)

If the leftmost character of the string str is a multibyte character, returns the code for that character, calculated from the numeric values of its constituent bytes using this formula:
```
  (1st byte code)
+ (2nd byte code * 256)
+ (3rd byte code * 256^2) ..., mysql> SELECT ORD('2');
        -> 50
```
If the leftmost character is not a multibyte character, ORD() returns the same value as the ASCII() function. The function returns NULL if str is NULL.
