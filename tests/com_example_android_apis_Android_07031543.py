#-*- coding:utf-8 -*-
from __future__ import division
import sys
sys.path.append("/Applications/TestWa.app/Contents/Lib/Python")
from appium import webdriver
from appium.webdriver.common.touch_action import TouchAction
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support import expected_conditions as EC
import time
from time import sleep
import os
import json
import unicodedata
import unittest
PATH = lambda p: os.path.abspath(os.path.join(os.path.dirname(__file__),p))

class TestwaTests(unittest.TestCase):
	def setUp(self):
		desired_caps = {}
		desired_caps['newCommandTimeout'] = 300
		desired_caps['unicodeKeyboard'] = True
		desired_caps['resetKeyboard'] = True
		desired_caps['platformName'] = 'Android'
		desired_caps['automationName'] = 'UiAutomator2'
		desired_caps['deviceName'] = 'S9BDU17406036655'
		desired_caps['app'] = './tests/ApiDemos-debug.apk'
		desired_caps['appPackage'] = 'com.example.android.apis'
		desired_caps['appActivity'] = 'com.example.android.apis.ApiDemos'

		global wd,screenRatioX,screenRatioY,action
		self.driver = webdriver.Remote('http://127.0.0.1:4723/wd/hub', desired_caps)
		wd = self.driver
		wd.implicitly_wait(60)
		action=TouchAction(wd)

		defaultParamConfig = {}
		for k,v in defaultParamConfig.items():
			setattr(self,k,v)
		#生成脚本的App占用屏幕尺寸(1080,1812)
		originScreenWidth = 1080.0
		originScreenHeight = 1812.0
		currentWindow = wd.get_window_size()
		currentScreenWidth = currentWindow['width']
		currentScreenHeight = currentWindow['height']
		screenRatioX = currentScreenWidth/originScreenWidth
		screenRatioY = currentScreenHeight/originScreenHeight

	def tearDown(self):
		wd.quit()

	def testTestwa(self):
		wd.find_element_by_xpath("//android.widget.TextView[@text='App']").click()
		sleep(5)
		wd.swipe(start_x=459*screenRatioX,start_y=1488*screenRatioY,end_x=471*screenRatioX,end_y=470*screenRatioY,duration=800)
		wd.find_element_by_xpath("//android.widget.TextView[@text='Search']").click()
		sleep(5)
		action.tap(x=209*screenRatioX,y=324*screenRatioY).perform()
		sleep(5)

if __name__ == '__main__':
	unittest.main(verbosity=2)
