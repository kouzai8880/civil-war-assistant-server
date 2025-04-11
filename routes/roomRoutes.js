// 踢出玩家
router.post('/:roomId/kick', protect, roomController.kickPlayer); 