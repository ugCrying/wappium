#-*- coding: UTF-8 -*- 
import os,sys
import unittest	
from testwa import webdriver
from testwa.webdriver.common.touch_action import TouchAction
from testwa.webdriver.common.multi_action import MultiAction
from time import sleep	
import unicodedata
import random

# Returns abs path relative to this file and not cwd	
PATH = lambda p: os.path.abspath(	
    os.path.join(os.path.dirname(__file__), p)	
)	

class TestwaTests(unittest.TestCase):	
    def setUp(self):	
        desired_caps = {}	
        desired_caps['platformName'] = 'Android'	
        desired_caps['deviceName'] = '68U5T18129004555'
        desired_caps['unicodeKeyboard'] = True
        desired_caps['resetKeyboard'] = True
        desired_caps['app'] = PATH('./ApiDemos-debug.apk')	
        desired_caps['appPackage'] = 'io.appium.android.apis'
        desired_caps['appActivity'] = 'io.appium.android.apis.ApiDemos'
        desired_caps['appWaitPackage'] = 'io.appium.android.apis'
        #desired_caps['appWaitActivity'] = '.MainActivity'
        desired_caps['newCommandTimeout'] = 3600
        desired_caps['noReset'] = True

        global wd,screenRatioX,screenRatioY,touchAction
        self.driver = webdriver.Remote('http://127.0.0.1:4723/wd/hub', desired_caps)
        wd = self.driver
        wd.implicitly_wait(60)       
        touchAction = TouchAction(wd)

        #record device width*height
        originScreenWidth = 1080.0
        originScreenHeight = 1920.0    
        windows_size = wd.get_window_size()  
        currentWidth = windows_size.get('width')
        currentHeight = windows_size.get('height')
        screenRatioX = currentWidth/originScreenWidth
        screenRatioY = currentHeight/originScreenHeight
	
    def tearDown(self):	
        wd.quit()
	
    def testTestwa(self):
        reload(sys)
        sys.setdefaultencoding( "utf-8" )
        
        #START_TO_RECORD_SCRIPT
        sleep(2)
        wd.find_element_by_xpath("//android.widget.ListView[@index='0']/android.widget.TextView[@index='0']").click()
        sleep(2)
        wd.find_element_by_xpath("//android.widget.ListView[@index='0']/android.widget.TextView[@index='0']").click()
        sleep(2)
        wd.back() #b3
        sleep(2)
        wd.back() #b4
        sleep(2)
        wd.back() #b4
        sleep(5)


if __name__ == '__main__':	
    unittest.main(verbosity=2)

