# Contributing

感谢你考虑为 MT-Engine 贡献改进。请在提交 PR 前确保本地检查与 CI 保持一致。

## 先决条件

- Python 3.12+
- Node 22

## 准备环境

复制 `.env.example` 为 `.env` 并填写本地配置；切勿提交 `.env` 或任何真实凭证。

## 后端

安装依赖：

```bash
pip install -r requirements-dev.txt
```

OpenAPI 漂移检查：

```bash
python scripts/export-openapi.py --check
```

测试：

```bash
python -m pytest -q
```

## 前端

以下命令可在仓库根目录运行；也可以进入 `frontend/` 目录后使用等价命令。

安装依赖：

```bash
npm ci --prefix frontend --legacy-peer-deps
```

API 类型漂移检查：

```bash
npm run check:api-types --prefix frontend
```

Lint：

```bash
npm run lint --prefix frontend
```

测试：

```bash
npm run test --prefix frontend
```

构建：

```bash
npm run build --prefix frontend
```

## 提交规范

提交信息沿用仓库现有前缀风格：`feat: / fix: / refactor: / docs: / chore:`。提交 PR 前请确认 CI 全绿。
