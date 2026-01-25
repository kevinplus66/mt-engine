# PANEL Known Issues and Limitations

**Version**: 1.0
**Date**: 2026-01-26

## Incomplete Data Fields

### Issue 1: Bonus (魔力值) Not Collected

**Status**: Known Limitation
**Severity**: Low (Non-critical feature)
**Affected Component**: Data Collection Service

**Description**:
The "Bonus" (魔力值) stat card displays "N/A" or 0 because the current M-Team API integration does not fetch bonus points data.

**Root Cause**:
- `app/services/mteam_api.py::fetch_user_profile()` only returns:
  - `share_ratio`
  - `uploaded`
  - `downloaded`
- The M-Team API response in `_fetch_profile_by_uid()` doesn't extract bonus from `memberCount` or `member` objects
- Database field `user_stats.bonus` remains NULL

**Affected Files**:
- `app/services/mteam_api.py:152-256` - fetch_user_profile() implementation
- `app/services/panel_collector.py:49` - save_user_stats() call (doesn't pass bonus parameter)

**Workaround**: None

**Future Fix**:
1. Investigate M-Team API response structure to find bonus field location
2. Update `_fetch_profile_by_uid()` to extract bonus:
   ```python
   bonus = _safe_int(member_count.get("bonus", 0))
   ```
3. Add bonus to return dict:
   ```python
   return {
       "share_ratio": share_ratio,
       "uploaded": uploaded,
       "downloaded": downloaded,
       "bonus": bonus,  # ADD THIS
       "uploaded_display": format_size(uploaded),
       "downloaded_display": format_size(downloaded)
   }
   ```
4. Update `panel_collector.py` to pass bonus:
   ```python
   await save_user_stats(
       timestamp=timestamp,
       share_ratio=profile['share_ratio'],
       uploaded=profile['uploaded'],
       downloaded=profile['downloaded'],
       bonus=profile.get('bonus'),  # ADD THIS
       seeding_count=seeding_count,
       leeching_count=leeching_count
   )
   ```

---

### Issue 2: User Level (等级) Not Collected

**Status**: Known Limitation
**Severity**: Low (Non-critical feature)
**Affected Component**: Data Collection Service

**Description**:
The "User Level" (用户等级) stat card displays "N/A" or empty because the current M-Team API integration does not fetch user level data.

**Root Cause**:
- Same as Issue 1 - `fetch_user_profile()` doesn't extract user_level from API response
- Database field `user_stats.user_level` remains NULL

**Affected Files**:
- `app/services/mteam_api.py:152-256`
- `app/services/panel_collector.py:49`

**Workaround**: None

**Future Fix**:
1. Find user level field in M-Team API response (likely `member.class` or `memberCount.userClass`)
2. Update `_fetch_profile_by_uid()` to extract:
   ```python
   user_level = member_count.get("userClass", "未知")
   # or
   user_level = member.get("class", "未知")
   ```
3. Add to return dict:
   ```python
   return {
       ...,
       "user_level": user_level  # ADD THIS
   }
   ```
4. Update `panel_collector.py` to pass user_level:
   ```python
   await save_user_stats(
       ...,
       user_level=profile.get('user_level')  # ADD THIS
   )
   ```

---

## Non-Critical TODOs

### Toast Notification Not Implemented

**Location**: `app/static/js/pages/panel.js:255`

**Code**:
```javascript
// TODO: 实现 toast 显示 (复用现有 toast 组件)
```

**Description**:
Error handling uses `console.error()` instead of showing user-friendly toast notifications.

**Impact**: Low - errors still logged, just not visually shown to user

**Fix**: Import and use existing toast component from `components/toast.js`

---

## Testing Notes

### Expected Behavior
- Bonus card will show "N/A" or 0 - this is **EXPECTED** behavior
- User Level card will show "N/A" or empty - this is **EXPECTED** behavior
- All other 6 stat cards should display real data

### Not Bugs
- NULL values in `user_stats.bonus` column - expected
- NULL values in `user_stats.user_level` column - expected

---

## Future Enhancements

1. **Investigate M-Team API**: Examine full API response structure to find missing fields
2. **Add Bonus Collection**: Update mteam_api.py to extract bonus points
3. **Add User Level Collection**: Update mteam_api.py to extract user level
4. **Toast Notifications**: Implement user-friendly error messages
5. **Data Export**: Add CSV/Excel export functionality (mentioned in design doc section 12)
6. **Comparison Mode**: Compare with RIVAL_USER_ID (mentioned in design doc section 12)
7. **Alerts**: Notify when share ratio drops below threshold (mentioned in design doc section 12)

---

**Document Status**: ✅ Complete
**Last Updated**: 2026-01-26
