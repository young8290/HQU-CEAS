/**
 * 测试专用工具（仅供 *.test.ts 引用，生产代码不得导入）。
 */

/**
 * 临时用 value 替换 target[key]（常用于打桩 prisma 模型方法），
 * 返回一个恢复函数：调用后按原属性描述符（或原值）还原。
 *
 * 与此前各测试文件内的同名私有实现逐字等价。
 */
export function replaceMethod(target: any, key: string, value: any) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const originalValue = target[key];
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value,
  });
  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor);
    } else {
      Object.defineProperty(target, key, {
        configurable: true,
        writable: true,
        value: originalValue,
      });
    }
  };
}
